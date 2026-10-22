const themeChoices = ['system', 'light', 'dark'];
const media = matchMedia('(prefers-color-scheme: dark)');
let preference;
try { preference = localStorage.getItem('workbench-theme'); } catch {}
if (!themeChoices.includes(preference)) preference = 'system';
function apply() {
  document.documentElement.dataset.theme = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
  document.documentElement.style.colorScheme = document.documentElement.dataset.theme;
  document.documentElement.dataset.themePreference = preference;
}
apply();
media.addEventListener('change', apply);
document.addEventListener('DOMContentLoaded', () => {
  const select = document.getElementById('theme-select');
  select.value = preference;
  const save = () => { apply(); try { localStorage.setItem('workbench-theme', preference); } catch {} window.workbench?.theme(preference).catch(() => {}); };
  select.addEventListener('change', () => { preference = select.value; save(); });
  save();
});
