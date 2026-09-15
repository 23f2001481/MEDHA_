"""Seed Bihar government schools (with districts + blocks) with official UDISE+ codes.

Idempotent: districts match on (name, state), blocks on (district_id, name),
schools on their generated UDISE code. Safe to re-run and safe against a
database that already has the Phase 0 test school.

Usage:
    uv run python scripts/seed_schools.py
    DATABASE_URL=<url> uv run python scripts/seed_schools.py
"""

from sqlalchemy.orm import Session

from backend.db.models import Block, District, School
from backend.db.session import SessionLocal, engine
from backend.reference.udise import BIHAR_DISTRICT_CODES

STATE = "Bihar"

# Mapping of (district_code, district_name, [(block_name, [locality, ...]), ...])
DISTRICT_DATA: list[tuple[str, str, list[tuple[str, list[str]]]]] = [
    ("28", "Patna", [
        ("Patna Sadar", ["Kankarbagh", "Bakerganj", "Gardanibagh", "Kadamkuan"]),
        ("Danapur", ["Khagaul", "Nasriganj", "Danapur Cantt", "Saguna More"]),
        ("Phulwari Sharif", ["Alinagar", "Nohsa", "Khojpura", "Janipur"]),
        ("Barh", ["Mokama", "Bakhtiyarpur", "Ghoswari", "Pandarak"]),
    ]),
    ("36", "Gaya", [
        ("Gaya Town", ["Manpur", "Chandauti", "Delha", "Buniyadganj"]),
        ("Bodh Gaya", ["Bakraur", "Pachatti", "Dumariya", "Mocharim"]),
        ("Sherghati", ["Dobhi", "Barachatti", "Amas", "Guraru"]),
    ]),
    ("14", "Muzaffarpur", [
        ("Mushahari", ["Ramna", "Bela", "Ahiyapur", "Rohua"]),
        ("Kanti", ["Chakia More", "Panapur", "Rupauli", "Sahebganj"]),
        ("Motipur", ["Baruraj", "Mahwal", "Kathaiya", "Muraul"]),
    ]),
    ("22", "Bhagalpur", [
        ("Nathnagar", ["Champanagar", "Habibpur", "Lodipur", "Barari"]),
        ("Sabour", ["Ghoghi", "Farka", "Rannuchak", "Ompur"]),
        ("Kahalgaon", ["Colgong", "Sanokhar", "Pirpainti", "Antichak"]),
    ]),
    ("27", "Nalanda", [
        ("Bihar Sharif", ["Sohsarai", "Pawapuri", "Kagol", "Ranchi More"]),
        ("Rajgir", ["Silao", "Nekpur", "Bargaon", "Giryek"]),
        ("Hilsa", ["Islampur", "Ekangarsarai", "Parwalpur", "Karai Parsurai"]),
    ]),
    ("13", "Darbhanga", [
        ("Darbhanga Sadar", ["Laheriasarai", "Donar", "Bahadurpur", "Mabbi"]),
        ("Benipur", ["Jhagrua", "Alinagar", "Rasiyari", "Sakri"]),
        ("Biraul", ["Kusheshwar Asthan", "Ghanshyampur", "Gaura Bauram", "Singhwara"]),
    ]),
    ("09", "Purnia", [
        ("Purnia East", ["Rambagh", "Madhubani", "Kasba Road", "Gulabbagh"]),
        ("Kasba", ["Bishnupur", "Chandrahi", "Saur", "Mahesh Tola"]),
        ("Banmankhi", ["Dharhara", "Barhara Kothi", "Krityanand Nagar", "Rupouli"]),
    ]),
    ("20", "Begusarai", [
        ("Begusarai Sadar", ["Lohiyanagar", "Ulao", "Barauni", "Ratanpur"]),
        ("Teghra", ["Refinery Colony", "Phaphaut", "Sadikpur", "Nirpur"]),
        ("Bakhri", ["Garhpura", "Naokothi", "Bakhaddarpur", "Mansurchak"]),
    ]),
    ("17", "Saran", [
        ("Chhapra Sadar", ["Salempur", "Daudpur", "Rasulpur", "Bhikhari Thakur Nagar"]),
        ("Marhaura", ["Dighwara", "Amnour", "Ekma", "Baniapur"]),
        ("Sonepur", ["Nayagaon", "Dariyapur", "Parsa", "Garkha"]),
    ]),
    ("32", "Rohtas", [
        ("Sasaram", ["Shivsagar", "Dehri", "Karma", "Tilouthu"]),
        ("Bikramganj", ["Nasriganj", "Dinara", "Nokha", "Rajpur"]),
        ("Kargahar", ["Chenari", "Sheosagar", "Dawath", "Suryapura"]),
    ]),
    ("18", "Vaishali", [
        ("Hajipur", ["Jadhua", "Industrial Area", "Ramashish Chowk", "Digha Ghat"]),
        ("Mahnar", ["Lalganj", "Bidupur", "Raghopur", "Jandaha"]),
        ("Vaishali Sadar", ["Goraul", "Bhagwanpur", "Patedhi Belsar", "Chehrakala"]),
    ]),
    ("19", "Samastipur", [
        ("Samastipur Sadar", ["Mohanpur", "Kashipur", "Patori", "Ujiyarpur"]),
        ("Rosera", ["Singhia", "Warisnagar", "Hasanpur", "Bibhutipur"]),
        ("Dalsinghsarai", ["Vidyapatinagar", "Sarairanjan", "Kalyanpur", "Morwa"]),
    ]),
    ("01", "Pashchim Champaran", [
        ("Bettiah", ["Kumarbagh", "Chanpatia", "Majhaulia", "Bairia"]),
        ("Narkatiaganj", ["Sikta", "Mainatand", "Gaunaha", "Lauriya"]),
    ]),
    ("02", "Purbi Champaran", [
        ("Motihari", ["Chauradano", "Raxaul", "Sugauli", "Areraj"]),
        ("Chakia", ["Mehsi", "Kalyanpur", "Kesaria", "Kotwa"]),
    ]),
    ("05", "Madhubani", [
        ("Madhubani Sadar", ["Rajnagar", "Pandaul", "Sakri", "Kaluahi"]),
        ("Jhanjharpur", ["Benipatti", "Babubarhi", "Khajauli", "Laukaha"]),
    ]),
    ("15", "Gopalganj", [
        ("Gopalganj Sadar", ["Thawe", "Kuchaikote", "Hathua", "Mirganj"]),
    ]),
    ("16", "Siwan", [
        ("Siwan Sadar", ["Mairwa", "Maharajganj", "Barharia", "Andar"]),
    ]),
    ("29", "Bhojpur", [
        ("Ara Sadar", ["Jagdishpur", "Piro", "Koilwar", "Sandesh"]),
    ]),
    ("30", "Buxar", [
        ("Buxar Sadar", ["Dumraon", "Itarhi", "Chaugain", "Simri"]),
    ]),
    ("35", "Aurangabad", [
        ("Aurangabad Sadar", ["Daudnagar", "Rafiganj", "Obra", "Goh"]),
    ]),
    ("37", "Nawada", [
        ("Nawada Sadar", ["Rajauli", "Hisua", "Pakribarawan", "Warisaliganj"]),
    ]),
    ("38", "Jamui", [
        ("Jamui Sadar", ["Jhajha", "Sono", "Chakai", "Sikandra"]),
    ]),
]

# (name template, school_type, medium) -- rotated per locality
TEMPLATES: list[tuple[str, str, str]] = [
    ("Rajkiya Prathmik Vidyalaya, {p}", "primary", "Hindi"),
    ("Rajkiya Madhya Vidyalaya, {p}", "middle", "Hindi"),
    ("Utkramit Madhya Vidyalaya, {p}", "middle", "Hindi"),
    ("Govt High School, {p}", "secondary", "Hindi"),
    ("Govt Girls High School, {p}", "secondary", "Hindi"),
    ("Govt +2 High School, {p}", "senior_secondary", "Hindi & English"),
    ("Kasturba Gandhi Balika Vidyalaya, {p}", "residential", "Hindi"),
    ("Model School, {p}", "senior_secondary", "English & Hindi"),
]


def get_or_create(db: Session, model, **kwargs):
    instance = db.query(model).filter_by(**kwargs).one_or_none()
    if instance is not None:
        return instance, False
    instance = model(**kwargs)
    db.add(instance)
    db.flush()
    return instance, True


def seed(db: Session) -> tuple[int, int, int]:
    made_d, made_b, made_s = 0, 0, 0

    for dist_code, district_name, blocks in DISTRICT_DATA:
        district, created = get_or_create(
            db, District, name=district_name, state=STATE
        )
        made_d += created
        if created:
            print(f"  + district  [{dist_code}] {district_name}")

        for bi, (block_name, localities) in enumerate(blocks, start=1):
            block, created = get_or_create(
                db, Block, district_id=district.id, name=block_name
            )
            made_b += created
            if created:
                print(f"    + block   {district_name} / {block_name}")

            for si, locality in enumerate(localities, start=1):
                idx = (int(dist_code) - 1 + (bi - 1) * len(localities) + (si - 1)) % len(TEMPLATES)
                tmpl, school_type, medium = TEMPLATES[idx]
                name = tmpl.format(p=locality)
                # Official UDISE standard: 10 (Bihar) + 2-digit district + 2-digit block + 5-digit village & school
                udise = f"10{dist_code}{bi:02d}{si:05d}"

                school = (
                    db.query(School).filter(School.udise_code == udise).one_or_none()
                )
                if school is None:
                    db.add(
                        School(
                            udise_code=udise,
                            name=name,
                            district_id=district.id,
                            block_id=block.id,
                            school_type=school_type,
                            medium_of_instruction=medium,
                        )
                    )
                    made_s += 1
                    print(f"      + school  [{udise}] {name}")
                else:
                    school.name = name

    db.commit()
    return made_d, made_b, made_s


def main() -> None:
    print("Connecting to database...")
    db = SessionLocal()
    try:
        print(f"Seeding Bihar schools across districts...")
        d, b, s = seed(db)
        total_s = db.query(School).count()
        total_d = db.query(District).count()
        total_b = db.query(Block).count()
        print(
            f"Done. Added {d} districts, {b} blocks, {s} schools. "
            f"Database now has {total_d} districts, {total_b} blocks, {total_s} schools."
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
