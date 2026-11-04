const relationships = new Map([
  ["mother", "mother"],
  ["father", "father"],
  ["guardian", "guardian"],
]);

export function parseRegisterForm(role, formData) {
  const base = {
    role,
    name: value(formData, role === "admin" ? "adminName" : "guardianName"),
    email: normalizeEmail(value(formData, "email")),
    phone: value(formData, "phone"),
    password: value(formData, "password"),
    confirmPassword: value(formData, "confirmPassword"),
  };
  const errors = {};

  requireField(errors, "name", base.name, "Name is required.");
  requireField(errors, "email", base.email, "Email is required.");
  requireField(errors, "password", base.password, "Password is required.");

  if (base.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(base.email)) {
    errors.email = "Enter a valid email address.";
  }

  if (base.password && base.password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }

  if (base.password !== base.confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  if (role === "admin") {
    const schoolName = value(formData, "schoolName");

    requireField(errors, "schoolName", schoolName, "School name is required.");
    requireField(errors, "phone", base.phone, "Phone number is required.");

    return finish(errors, {
      role,
      name: base.name,
      email: base.email,
      phone: base.phone || null,
      password: base.password,
      profile: { schoolName, staffRole: "school_administrator" },
    });
  }

  const relationship = relationships.get(value(formData, "relationship").toLowerCase());
  const studentClaims = studentClaimValues(formData);
  const studentReferences = studentClaims.map((claim) => claim.reference);
  const studentReference = studentReferences[0] ?? "";
  const schoolCode = value(formData, "schoolCode").toUpperCase();

  requireField(errors, "phone", base.phone, "Phone number is required.");
  if (studentClaims.length > 10) {
    errors.studentClaims = "Add no more than 10 students.";
  } else if (studentClaims.some((claim) => claim.reference.length > 60 || claim.firstName.length > 80 || claim.lastName.length > 80)) {
    errors.studentClaims = "Check the maximum length of the student details.";
  } else if (studentClaims.some((claim) => !claim.reference || !claim.firstName || !claim.lastName)) {
    errors.studentClaims = "Complete the reference, first name, and last name for every student.";
  }
  if (!relationship) {
    errors.relationship = "Choose a valid relationship.";
  }

  return finish(errors, {
    role,
    name: base.name,
    email: base.email,
    phone: base.phone || null,
    password: base.password,
    profile: { schoolCode, studentName: studentReference, studentReference, studentReferences, studentClaims, relationship },
  });
}

export function parseLoginForm(role, formData) {
  const identifierName = role === "admin" ? "email" : "identifier";
  const identifier = normalizeEmail(value(formData, identifierName));
  const password = value(formData, "password");
  const errors = {};

  requireField(errors, identifierName, identifier, "Email or phone is required.");
  requireField(errors, "password", password, "Password is required.");

  return finish(errors, { role, identifier, password });
}

function finish(errors, data) {
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, data };
}

function normalizeEmail(input) {
  return input.trim().toLowerCase();
}

function requireField(errors, key, fieldValue, message) {
  if (!fieldValue) {
    errors[key] = message;
  }
}

function value(formData, key) {
  const fieldValue = formData.get(key);
  return typeof fieldValue === "string" ? fieldValue.trim() : "";
}

function studentClaimValues(formData) {
  const getAll = (key) => typeof formData.getAll === "function"
    ? formData.getAll(key)
    : formData.get(key) == null ? [] : [formData.get(key)];
  const references = getAll("studentReferences");
  const firstNames = getAll("studentFirstNames");
  const lastNames = getAll("studentLastNames");
  const count = Math.max(references.length, firstNames.length, lastNames.length);
  const seen = new Set();
  const claims = [];
  for (let index = 0; index < count; index += 1) {
    const claim = {
      reference: typeof references[index] === "string" ? references[index].trim() : "",
      firstName: typeof firstNames[index] === "string" ? firstNames[index].trim() : "",
      lastName: typeof lastNames[index] === "string" ? lastNames[index].trim() : "",
    };
    if (!claim.reference && !claim.firstName && !claim.lastName) continue;
    const key = `${claim.reference}|${claim.firstName}|${claim.lastName}`.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    claims.push(claim);
  }
  return claims;
}
