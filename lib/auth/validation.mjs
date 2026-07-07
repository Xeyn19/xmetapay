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
  const studentReferences = studentReferenceValues(formData);
  const studentReference = studentReferences[0] ?? "";

  requireField(errors, "phone", base.phone, "Phone number is required.");
  requireField(errors, "studentReferences", studentReference, "Add at least one student ID or reference.");
  if (!relationship) {
    errors.relationship = "Choose a valid relationship.";
  }

  return finish(errors, {
    role,
    name: base.name,
    email: base.email,
    phone: base.phone || null,
    password: base.password,
    profile: { studentName: studentReference, studentReference, studentReferences, relationship },
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

function studentReferenceValues(formData) {
  const rawValues = typeof formData.getAll === "function"
    ? formData.getAll("studentReferences")
    : [];
  const fallback = value(formData, "studentReference");
  const values = rawValues.length > 0 ? rawValues : [fallback];
  const seen = new Set();

  return values
    .filter((fieldValue) => typeof fieldValue === "string")
    .map((fieldValue) => fieldValue.trim())
    .filter(Boolean)
    .filter((fieldValue) => {
      const key = fieldValue.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}
