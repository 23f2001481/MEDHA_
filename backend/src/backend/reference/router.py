from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.db.models import Block, District, Grade, School, Subject
from backend.db.session import get_db
from backend.reference.schemas import GradeOut, SchoolSearchResult, SubjectOut
from backend.reference.udise import is_valid_udise_code, resolve_or_create_udise_school

router = APIRouter(tags=["reference"])


@router.get("/reference/grades", response_model=list[GradeOut])
def list_grades(db: Session = Depends(get_db)) -> list[Grade]:
    return db.query(Grade).order_by(Grade.numeric_level).all()


@router.get("/reference/subjects", response_model=list[SubjectOut])
def list_subjects(db: Session = Depends(get_db)) -> list[Subject]:
    return db.query(Subject).order_by(Subject.name).all()


@router.get("/schools/by-udise/{udise_code}", response_model=SchoolSearchResult)
def get_school_by_udise(
    udise_code: str,
    db: Session = Depends(get_db),
) -> SchoolSearchResult:
    """Retrieve or dynamically resolve a government school by its 11-digit UDISE code."""
    cleaned = udise_code.strip()
    if not is_valid_udise_code(cleaned):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid UDISE code. Code must be exactly 11 numeric digits.",
        )

    school = resolve_or_create_udise_school(db, cleaned)
    if not school:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"School with UDISE code {cleaned} not found.",
        )

    district_name = school.district.name if school.district else "Unknown District"
    block_name = school.block.name if school.block else None

    return SchoolSearchResult(
        id=school.id,
        name=school.name,
        district_name=district_name,
        block_name=block_name,
        udise_code=school.udise_code,
    )


@router.get("/schools/search", response_model=list[SchoolSearchResult])
def search_schools(
    q: str = Query(..., min_length=1, max_length=100),
    db: Session = Depends(get_db),
) -> list[SchoolSearchResult]:
    clean_q = q.strip()
    like = f"%{clean_q}%"

    rows = (
        db.query(School, District.name, Block.name)
        .join(District, School.district_id == District.id)
        .outerjoin(Block, School.block_id == Block.id)
        .filter(or_(School.name.ilike(like), School.udise_code.ilike(like)))
        .order_by(
            # Exact UDISE matches come first
            (School.udise_code == clean_q).desc(),
            School.name,
        )
        .limit(10)
        .all()
    )

    results = [
        SchoolSearchResult(
            id=school.id,
            name=school.name,
            district_name=district_name,
            block_name=block_name,
            udise_code=school.udise_code,
        )
        for school, district_name, block_name in rows
    ]

    # Smart Fallback: If 11 digits are entered and not in DB yet, dynamically resolve it
    if not results and is_valid_udise_code(clean_q):
        resolved = resolve_or_create_udise_school(db, clean_q)
        if resolved:
            d_name = resolved.district.name if resolved.district else "Bihar"
            b_name = resolved.block.name if resolved.block else None
            results.append(
                SchoolSearchResult(
                    id=resolved.id,
                    name=resolved.name,
                    district_name=d_name,
                    block_name=b_name,
                    udise_code=resolved.udise_code,
                )
            )

    return results
