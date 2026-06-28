function createFieldWrapper(labelText, id, helperText, errorText, disabled) {
  const wrapper = document.createElement("div");
  wrapper.className = "form-field";

  if (labelText) {
    const label = document.createElement("label");
    label.className = "form-field__label";
    label.htmlFor = id;
    label.textContent = labelText;
    wrapper.appendChild(label);
  }

  return { wrapper };
}

function wireValidationState(input, helperText, errorText, disabled) {
  input.classList.toggle("is-invalid", Boolean(errorText));
  input.toggleAttribute("aria-invalid", Boolean(errorText));
  input.toggleAttribute("disabled", disabled);

  if (helperText) {
    const helper = document.createElement("p");
    helper.className = "form-field__helper";
    helper.textContent = helperText;
    input.parentElement.appendChild(helper);
  }

  if (errorText) {
    const error = document.createElement("p");
    error.className = "form-field__error";
    error.textContent = errorText;
    input.parentElement.appendChild(error);
  }
}

function makeInput(config = {}) {
  const { label, id, placeholder, helperText, errorText, disabled = false, required = false } = config;
  const { wrapper } = createFieldWrapper(label, id, helperText, errorText, disabled);
  const input = document.createElement("input");
  input.className = "form-field__input";
  input.id = id;
  input.name = config.name || id;
  input.placeholder = placeholder || "";
  input.disabled = disabled;
  input.required = required;
  wrapper.appendChild(input);
  wireValidationState(input, helperText, errorText, disabled);
  return wrapper;
}

export function createNumberInput(config = {}) {
  const field = makeInput({ ...config, type: "number" });
  const input = field.querySelector("input");
  input.type = "number";
  input.inputMode = "decimal";
  input.step = config.step || "any";
  return field;
}

export function createDecimalInput(config = {}) {
  const field = createNumberInput({ ...config, step: config.step || "any" });
  field.querySelector("input").setAttribute("aria-describedby", `${config.id || config.name}-helper`);
  return field;
}

export function createIntegerInput(config = {}) {
  const field = createNumberInput({ ...config, step: config.step || "1" });
  const input = field.querySelector("input");
  input.step = "1";
  input.pattern = "-?\\d+";
  return field;
}

export function createDropdown(config = {}) {
  const { label, id, options = [], helperText, errorText, disabled = false, required = false, placeholder = "Select an option" } = config;
  const { wrapper } = createFieldWrapper(label, id, helperText, errorText, disabled);
  const select = document.createElement("select");
  select.className = "form-field__input form-field__select";
  select.id = id;
  select.name = config.name || id;
  select.disabled = disabled;
  select.required = required;

  if (placeholder) {
    const placeholderOption = document.createElement("option");
    placeholderOption.textContent = placeholder;
    placeholderOption.value = "";
    select.appendChild(placeholderOption);
  }

  options.forEach((option) => {
    const optionElement = document.createElement("option");
    optionElement.value = option.value;
    optionElement.textContent = option.label;
    if (option.selected) {
      optionElement.selected = true;
    }
    select.appendChild(optionElement);
  });

  wrapper.appendChild(select);
  wireValidationState(select, helperText, errorText, disabled);
  return wrapper;
}

export function createUnitSelector(config = {}) {
  return createDropdown({
    ...config,
    options: config.units?.map((unit) => ({ label: unit.label, value: unit.value })) || [],
  });
}

export function createToggleSwitch(config = {}) {
  const { id, label, checked = false, disabled = false, helperText, errorText, onChange } = config;
  const wrapper = document.createElement("div");
  wrapper.className = "form-field form-field--toggle";

  if (label) {
    const labelElement = document.createElement("label");
    labelElement.className = "form-field__label";
    labelElement.textContent = label;
    wrapper.appendChild(labelElement);
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "toggle";
  button.id = id;
  button.setAttribute("role", "switch");
  button.setAttribute("aria-checked", checked ? "true" : "false");
  button.classList.toggle("is-on", checked);
  button.disabled = disabled;

  const thumb = document.createElement("span");
  thumb.className = "toggle__thumb";
  button.appendChild(thumb);

  button.addEventListener("click", () => {
    const current = button.getAttribute("aria-checked") === "true";
    const next = !current;
    button.setAttribute("aria-checked", String(next));
    button.classList.toggle("is-on", next);
    if (typeof onChange === "function") {
      onChange(next);
    }
  });

  button.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      button.click();
    }
  });

  wrapper.appendChild(button);
  wireValidationState(button, helperText, errorText, disabled);
  return wrapper;
}
