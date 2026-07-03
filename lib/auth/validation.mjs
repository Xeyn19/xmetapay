const adminRoles = new Map([
  ["finance officer", "finance_officer"],
  ["registrar", "registrar"],
  ["school administrator", "school_administrator"],
]);

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
    const staffRole = adminRoles.get(value(formData, "staffRole").toLowerCase());
    const schoolName = value(formData, "schoolName");

    requireField(errors, "schoolName", schoolName, "School name is required.");
    if (!staffRole) {
      errors.staffRole = "Choose a valid staff role.";
    }

    return finish(errors, {
      role,
      name: base.name,
      email: base.email,
      phone: base.phone || null,
      password: base.password,
      profile: { schoolName, staffRole },
    });
  }

  const relationship = relationships.get(value(formData, "relationship").toLowerCase());
  const studentReference = value(formData, "studentReference");

  requireField(errors, "phone", base.phone, "Phone number is required.");
  requireField(errors, "studentReference", studentReference, "Student ID or reference is required.");
  if (!relationship) {
    errors.relationship = "Choose a valid relationship.";
  }

  return finish(errors, {
    role,
    name: base.name,
    email: base.email,
    phone: base.phone || null,
    password: base.password,
    profile: { studentName: studentReference, studentReference, relationship },
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
