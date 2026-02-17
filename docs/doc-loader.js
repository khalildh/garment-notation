// Shared doc loader — reads data-file from the script tag, fetches + renders it
(async function () {
  const script = document.currentScript;
  const file = script.dataset.file;
  const el = document.getElementById('content');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  const menuToggle = document.getElementById('menuToggle');

  // Mobile menu
  menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
  });
  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  });

  // Fetch and render
  try {
    const res = await fetch(file);
    if (!res.ok) throw new Error('Failed to load ' + file);
    const md = await res.text();
    el.innerHTML = '<div class="md">' + marked.parse(md) + '</div>';
  } catch (err) {
    el.innerHTML = '<p class="error">Could not load document: ' + err.message + '</p>';
  }
})();
