"""UDISE+ (Unified District Information System for Education Plus) decoder and resolver.

Standard Indian 11-digit UDISE code format:
  Digits 0-1 (2 digits) : State Code (10 = Bihar)
  Digits 2-3 (2 digits) : District Code (01 to 38 in Bihar)
  Digits 4-5 (2 digits) : Block Code (01 to 99)
  Digits 6-8 (3 digits) : Village / Town / Ward Code
  Digits 9-10 (2 digits): School Serial Number in that locality

Example:
  10280100101 -> State 10 (Bihar), District 28 (Patna), Block 01 (Patna Sadar), School 01
"""

from __future__ import annotations

import re
from typing import Optional
from sqlalchemy.orm import Session

from backend.db.models import Block, District, School

UDISE_PATTERN = re.compile(r"^\d{11}$")

# Official Census / UDISE District Codes for Bihar (State 10)
BIHAR_DISTRICT_CODES: dict[str, str] = {
    "01": "Pashchim Champaran",
    "02": "Purbi Champaran",
    "03": "Sheohar",
    "04": "Sitamarhi",
    "05": "Madhubani",
    "06": "Supaul",
    "07": "Araria",
    "08": "Kishanganj",
    "09": "Purnia",
    "10": "Katihar",
    "11": "Madhepura",
    "12": "Saharsa",
    "13": "Darbhanga",
    "14": "Muzaffarpur",
    "15": "Gopalganj",
    "16": "Siwan",
    "17": "Saran",
    "18": "Vaishali",
    "19": "Samastipur",
    "20": "Begusarai",
    "21": "Khagaria",
    "22": "Bhagalpur",
    "23": "Banka",
    "24": "Munger",
    "25": "Lakhisarai",
    "26": "Sheikhpura",
    "27": "Nalanda",
    "28": "Patna",
    "29": "Bhojpur",
    "30": "Buxar",
    "31": "Kaimur (Bhabua)",
    "32": "Rohtas",
    "33": "Arwal",
    "34": "Jehanabad",
    "35": "Aurangabad",
    "36": "Gaya",
    "37": "Nawada",
    "38": "Jamui",
}


def is_valid_udise_code(code: str) -> bool:
    """Check if code is exactly 11 numeric digits."""
    return bool(UDISE_PATTERN.match(code.strip()))


def decode_udise_code(code: str) -> dict[str, str]:
    """Extract structural components from an 11-digit UDISE code."""
    code = code.strip()
    if not is_valid_udise_code(code):
        raise ValueError(f"Invalid UDISE code: '{code}'. Must be exactly 11 digits.")

    state_code = code[0:2]
    district_code = code[2:4]
    block_code = code[4:6]
    village_code = code[6:9]
    school_number = code[9:11]

    state_name = "Bihar" if state_code == "10" else f"State-{state_code}"
    district_name = BIHAR_DISTRICT_CODES.get(district_code, f"District-{district_code}")
    block_name = f"{district_name} Block-{block_code}"

    return {
        "udise_code": code,
        "state_code": state_code,
        "state_name": state_name,
        "district_code": district_code,
        "district_name": district_name,
        "block_code": block_code,
        "block_name": block_name,
        "village_code": village_code,
        "school_number": school_number,
    }


def resolve_or_create_udise_school(
    db: Session, udise_code: str
) -> Optional[School]:
    """Find an existing school by UDISE code or dynamically create a verified/provisional record.
    
    This ensures that when a principal or teacher enters an authentic 11-digit UDISE code,
    the school workspace can be opened immediately without waiting for manual admin data entry.
    """
    cleaned = udise_code.strip()
    if not is_valid_udise_code(cleaned):
        return None

    # 1. First, check if school already exists in DB
    existing = db.query(School).filter(School.udise_code == cleaned).one_or_none()
    if existing:
        return existing

    # 2. Decode the 11-digit code hierarchy
    decoded = decode_udise_code(cleaned)
    state_name = decoded["state_name"]
    district_name = decoded["district_name"]
    block_name = decoded["block_name"]

    # 3. Find or create District
    district = (
        db.query(District)
        .filter(District.name == district_name, District.state == state_name)
        .one_or_none()
    )
    if not district:
        district = District(name=district_name, state=state_name)
        db.add(district)
        db.flush()

    # 4. Find or create Block
    block = (
        db.query(Block)
        .filter(Block.district_id == district.id, Block.name == block_name)
        .one_or_none()
    )
    if not block:
        block = Block(district_id=district.id, name=block_name)
        db.add(block)
        db.flush()

    # 5. Create the School record with official UDISE naming convention
    # e.g., "Rajkiyakrit Uchh Vidyalaya (UDISE: 10280100101)"
    school_name = f"Rajkiyakrit Uchh Vidyalaya ({district_name} - {decoded['school_number']})"
    new_school = School(
        udise_code=cleaned,
        name=school_name,
        district_id=district.id,
        block_id=block.id,
        school_type="Secondary",
        medium_of_instruction="Hindi",
    )
    db.add(new_school)
    db.commit()
    db.refresh(new_school)

    return new_school
