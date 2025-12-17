// settings.ts
export {};

declare function addListener(target: EventTarget | null, event: string, handler: EventListenerOrEventListenerObject): void;

type SectionName = string;

const menuItems = document.querySelectorAll<HTMLLIElement>('.settings-item');
const sections = document.querySelectorAll<HTMLElement>('.settings-section');

function showSection(sectionName: SectionName): void {
  sections.forEach((section) => {
    const isActive = section.dataset.section === sectionName;
    section.classList.toggle('unloaded', !isActive);
  });

  menuItems.forEach((item) => {
    const isActive = item.dataset.section === sectionName;
    item.classList.toggle('active', isActive);
  });

  // Accessibility: focus first interactive element
  const activeSection = document.querySelector<HTMLElement>(
    `.settings-section[data-section="${sectionName}"]`
  );

  if (!activeSection) return;

  const focusable = activeSection.querySelector<HTMLElement>(
    'input, button, select, textarea, a'
  );

  focusable?.focus();
}

menuItems.forEach((item) => {
  addListener(item, 'click', () => {
    const section = item.dataset.section;
    if (!section) return;

    showSection(section);
  });
});

// Initial section
showSection('profile');
