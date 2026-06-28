export function normalizeValidationRules(rules = {}) {
  return {
    required: Boolean(rules.required),
    positive: Boolean(rules.positive),
    integer: Boolean(rules.integer),
    decimal: Boolean(rules.decimal),
    min: rules.min ?? null,
    max: rules.max ?? null,
    empty: Boolean(rules.empty),
  };
}

function parseNumericValue(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = String(value).trim();
  if (normalized === "") {
    return null;
  }

  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function createValidationResult(value, rules, errors) {
  return {
    value,
    rules,
    errors,
    isValid: errors.length === 0,
  };
}

export function validateField(value, rules = {}) {
  const normalizedRules = normalizeValidationRules(rules);
  const errors = [];
  const rawValue = value ?? "";
  const trimmedValue = typeof rawValue === "string" ? rawValue.trim() : rawValue;

  if (normalizedRules.required && (trimmedValue === "" || (Array.isArray(trimmedValue) && trimmedValue.length === 0))) {
    errors.push("This field is required.");
  }

  if (trimmedValue === "") {
    return createValidationResult(trimmedValue, normalizedRules, errors);
  }

  if (normalizedRules.empty && trimmedValue === "") {
    errors.push("Input cannot be empty.");
  }

  const numericValue = parseNumericValue(trimmedValue);

  if (normalizedRules.positive) {
    if (numericValue === null || numericValue <= 0) {
      errors.push("Value must be greater than zero.");
    }
  }

  if (normalizedRules.integer) {
    if (!/^[-+]?\d+$/.test(String(trimmedValue))) {
      errors.push("Value must be an integer.");
    }
  }

  if (normalizedRules.decimal) {
    if (numericValue === null) {
      errors.push("Please enter a valid number.");
    }
  }

  if (normalizedRules.min !== null && numericValue !== null && numericValue < normalizedRules.min) {
    errors.push(`Value must be at least ${normalizedRules.min}.`);
  }

  if (normalizedRules.max !== null && numericValue !== null && numericValue > normalizedRules.max) {
    errors.push(`Value must be no more than ${normalizedRules.max}.`);
  }

  return createValidationResult(trimmedValue, normalizedRules, errors);
}

export function validateForm(fields) {
  const results = {};
  let isValid = true;

  Object.entries(fields).forEach(([name, config]) => {
    const result = validateField(config.value, config.rules);
    results[name] = result;
    if (!result.isValid) {
      isValid = false;
    }
  });

  return {
    isValid,
    results,
    errors: Object.values(results).flatMap((result) => result.errors),
  };
}

export function summarizeValidation(results) {
  return Object.entries(results)
    .filter(([, result]) => !result.isValid)
    .map(([name, result]) => ({ name, errors: result.errors }))
    .flatMap((entry) => entry.errors.map((error) => `${entry.name}: ${error}`));
}
