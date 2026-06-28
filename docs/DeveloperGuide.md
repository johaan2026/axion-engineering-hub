# Developer Guide

## Naming conventions

- Use lowercase file names and hyphenated module names.
- Keep page modules in js/pages/ and shared infrastructure in js/framework/.
- Prefer descriptive function names and small ES modules.

## Coding standards

- Use vanilla ES modules only.
- Preserve the current design system and accessibility patterns.
- Avoid direct DOM duplication by using shared helpers.
- Keep comments focused on non-obvious logic.

## Validation flow

1. Collect user input.
2. Pass values to validateField() or validateForm().
3. Surface validation errors in the UI.
4. Only compute when inputs are valid.

## Storage structure

- calculation history: array of recent calculations
- favourite calculators: array of saved calculator references
- recent calculators: array of most recently viewed calculators
- settings: object of preference flags
- last opened page: string identifier

## Accessibility

- Preserve semantic HTML and keyboard navigation.
- Keep form labels and helper text available.
- Use ARIA roles for custom toggles and notifications.
