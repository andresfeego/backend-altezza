function normalizeInvitationModuleType(value) {
  const type = String(value || '').trim();
  return type === 'image_slider_sepia' ? 'image_slider_1' : type;
}

function renameImageSliderModules(modules, from = 'image_slider_sepia', to = 'image_slider_1') {
  if (!Array.isArray(modules)) return modules;
  return modules.map(module => module?.type === from ? { ...module, type: to } : module);
}

module.exports = { normalizeInvitationModuleType, renameImageSliderModules };
