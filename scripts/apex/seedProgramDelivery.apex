// Idempotent: delivery data for ABC Hope's own programs (D-33) — records only, no metadata.
// Program ─< Benefit; Program ─< ProgramEnrollment ─< BenefitAssignment ─< BenefitDisbursement.
// Beneficiaries are existing people already enrolled in the org's Food Access program (no new accounts).
// A program that already has enrollments is skipped. Run after seedPrograms.apex.
// Run: sf apex run -o npo-demo -f scripts/apex/seedProgramDelivery.apex
Boolean DRY_RUN = false; // true: run everything, then roll back

List<List<Object>> specs = new List<List<Object>>{
  // program, people enrolled, benefits: { name, benefit type, unit, min quantity, max quantity }
  new List<Object>{
    'Child Wellbeing',
    60,
    new List<List<Object>>{
      new List<Object>{ 'Toy parcel', 'Goods Distribution', 'Items', 1, 2 },
      new List<Object>{ 'Winter clothing pack', 'Goods Distribution', 'Items', 1, 1 }
    }
  },
  new List<Object>{
    'Education Access',
    80,
    new List<List<Object>>{
      new List<Object>{ 'Learning kit', 'Goods Distribution', 'Items', 1, 1 },
      new List<Object>{ 'Storybook', 'Goods Distribution', 'Items', 1, 3 }
    }
  },
  new List<Object>{
    'Family Support',
    50,
    new List<List<Object>>{
      new List<Object>{ 'Holiday meal', 'Meal Distribution', 'Meals', 4, 12 },
      new List<Object>{ 'Grocery voucher', 'Goods Distribution', 'Items', 1, 2 }
    }
  },
  new List<Object>{
    'Clean Water',
    40,
    new List<List<Object>>{
      new List<Object>{ 'Water filter kit', 'Goods Distribution', 'Items', 1, 1 }
    }
  },
  new List<Object>{
    'Green Communities',
    30,
    new List<List<Object>>{
      new List<Object>{ 'Tree sapling', 'Goods Distribution', 'Items', 3, 10 }
    }
  }
};

Savepoint sp = Database.setSavepoint();

// Lookups: programs, benefit types and units (created when missing).
Set<String> programNames = new Set<String>();
Set<String> typeNames = new Set<String>();
Set<String> unitNames = new Set<String>();
for (List<Object> s : specs) {
  programNames.add((String) s[0]);
  for (List<Object> b : (List<List<Object>>) s[2]) {
    typeNames.add((String) b[1]);
    unitNames.add((String) b[2]);
  }
}
Map<String, Program> programs = new Map<String, Program>();
for (Program p : [SELECT Id, Name FROM Program WHERE Name IN :programNames])
  programs.put(p.Name, p);
Map<String, String> unitByType = new Map<String, String>();
for (List<Object> s : specs) {
  for (List<Object> b : (List<List<Object>>) s[2])
    unitByType.put((String) b[1], (String) b[2]);
}
Map<String, Id> unitIds = new Map<String, Id>();
for (UnitOfMeasure u : [SELECT Id, Name FROM UnitOfMeasure WHERE Name IN :unitNames])
  unitIds.put(u.Name, u.Id);
List<UnitOfMeasure> newUnits = new List<UnitOfMeasure>();
for (String n : unitNames) {
  if (!unitIds.containsKey(n))
    newUnits.add(new UnitOfMeasure(Name = n, UnitCode = n.toLowerCase(), Type = 'Custom'));
}
insert newUnits;
for (UnitOfMeasure u : newUnits)
  unitIds.put(u.Name, u.Id);
// A benefit type needs a unit; new types are goods handed out, counted in the unit of their benefits.
Map<String, Id> typeIds = new Map<String, Id>();
for (BenefitType t : [SELECT Id, Name FROM BenefitType WHERE Name IN :typeNames])
  typeIds.put(t.Name, t.Id);
List<BenefitType> newTypes = new List<BenefitType>();
for (String n : typeNames) {
  if (!typeIds.containsKey(n)) {
    newTypes.add(
      new BenefitType(
        Name = n,
        ProcessType = 'ProgramManagement',
        Type = 'Goods',
        UnitofMeasureId = unitIds.get(unitByType.get(n))
      )
    );
  }
}
insert newTypes;
for (BenefitType t : newTypes)
  typeIds.put(t.Name, t.Id);

// Benefits per program (upsert by program + name).
Map<String, Benefit> benefits = new Map<String, Benefit>();
for (Benefit b : [
  SELECT Id, Name, ProgramId, Program.Name
  FROM Benefit
  WHERE Program.Name IN :programNames
])
  benefits.put(b.Program.Name + '|' + b.Name, b);
List<Benefit> newBenefits = new List<Benefit>();
for (List<Object> s : specs) {
  Program p = programs.get((String) s[0]);
  if (p == null)
    continue;
  for (List<Object> b : (List<List<Object>>) s[2]) {
    if (!benefits.containsKey(p.Name + '|' + b[0])) {
      Benefit nb = new Benefit(
        Name = (String) b[0],
        ProgramId = p.Id,
        BenefitTypeId = typeIds.get((String) b[1]),
        UnitId = unitIds.get((String) b[2]),
        BenefitStatus = 'Active',
        IsActive = true,
        StartDateTime = Datetime.newInstance(2026, 1, 1)
      );
      newBenefits.add(nb);
      benefits.put(p.Name + '|' + b[0], nb);
    }
  }
}
insert newBenefits;

// Programs that already have enrollments are left as they are.
Set<Id> enrolledPrograms = new Set<Id>();
for (AggregateResult ar : [
  SELECT ProgramId
  FROM ProgramEnrollment
  WHERE ProgramId IN :programs.values()
  GROUP BY ProgramId
])
  enrolledPrograms.add((Id) ar.get('ProgramId'));

// Beneficiary pool: existing people in the org's Food Access program.
Integer needed = 0;
for (List<Object> s : specs)
  needed += (Integer) s[1];
List<Id> pool = new List<Id>();
for (ProgramEnrollment pe : [
  SELECT AccountId
  FROM ProgramEnrollment
  WHERE Program.Name = 'Food Access' AND AccountId != NULL
  ORDER BY AccountId
  LIMIT :needed
])
  pool.add(pe.AccountId);

List<ProgramEnrollment> enrollments = new List<ProgramEnrollment>();
Map<Integer, List<Object>> specByEnrollment = new Map<Integer, List<Object>>();
Integer next = 0;
for (List<Object> s : specs) {
  Program p = programs.get((String) s[0]);
  Integer count = (Integer) s[1];
  if (p == null || enrolledPrograms.contains(p.Id)) {
    next += count;
    continue;
  }
  for (Integer i = 0; i < count && next < pool.size(); i++) {
    specByEnrollment.put(enrollments.size(), s);
    enrollments.add(
      new ProgramEnrollment(
        Name = p.Name + ' – ' + (i + 1),
        ProgramId = p.Id,
        AccountId = pool[next++],
        Status = Math.mod(i, 5) == 0 ? 'Completed' : 'In Progress'
      )
    );
  }
}
insert enrollments;

// One assignment per enrollment and benefit, each with one delivery in the last 120 days.
List<BenefitAssignment> assignments = new List<BenefitAssignment>();
List<List<Object>> assignmentSpecs = new List<List<Object>>();
for (Integer i = 0; i < enrollments.size(); i++) {
  ProgramEnrollment pe = enrollments[i];
  List<Object> s = specByEnrollment.get(i);
  for (List<Object> b : (List<List<Object>>) s[2]) {
    Benefit ben = benefits.get((String) s[0] + '|' + b[0]);
    assignments.add(
      new BenefitAssignment(
        BenefitId = ben.Id,
        ParentRecordId = pe.Id,
        ProgramEnrollmentId = pe.Id,
        EnrolleeId = pe.AccountId,
        UnitOfMeasureId = unitIds.get((String) b[2]),
        Status = 'Active'
      )
    );
    assignmentSpecs.add(new List<Object>{ pe, b, i });
  }
}
insert assignments;

List<BenefitDisbursement> deliveries = new List<BenefitDisbursement>();
for (Integer i = 0; i < assignments.size(); i++) {
  ProgramEnrollment pe = (ProgramEnrollment) assignmentSpecs[i][0];
  List<Object> b = (List<Object>) assignmentSpecs[i][1];
  Integer minQ = (Integer) b[3];
  Integer maxQ = (Integer) b[4];
  deliveries.add(
    new BenefitDisbursement(
      BenefitAssignmentId = assignments[i].Id,
      ProgramEnrollmentId = pe.Id,
      RecipientId = pe.AccountId,
      RecipientType = 'Program Enrollment',
      ActualCompletionDate = Datetime.now().addDays(-1 - Math.mod(i * 7, 120)),
      DisbursedQuantity = minQ + Math.mod(i, maxQ - minQ + 1),
      UnitOfMeasureId = unitIds.get((String) b[2]),
      BenefitCategory = 'Goods',
      DisbursementStatus = 'Disbursed',
      ApprovalStatus = 'Not Applicable',
      PaymentStatus = 'Not Applicable'
    )
  );
}
insert deliveries;

System.debug(
  'Program delivery OK: ' +
    newBenefits.size() +
    ' benefits, ' +
    enrollments.size() +
    ' enrollments, ' +
    assignments.size() +
    ' assignments, ' +
    deliveries.size() +
    ' deliveries' +
    (DRY_RUN ? ' (dry run, rolled back)' : '')
);
if (DRY_RUN)
  Database.rollback(sp);
