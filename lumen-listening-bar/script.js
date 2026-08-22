const menuButton = document.querySelector('.menu-button');
const mobileMenu = document.querySelector('.mobile-menu');
const menuLinks = document.querySelectorAll('.mobile-menu a');

function closeMenu() {
  menuButton.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
  mobileMenu.classList.remove('open');
  document.body.style.overflow = '';
}

menuButton?.addEventListener('click', () => {
  const isOpen = mobileMenu.classList.toggle('open');
  menuButton.classList.toggle('open', isOpen);
  menuButton.setAttribute('aria-expanded', String(isOpen));
  document.body.style.overflow = isOpen ? 'hidden' : '';
});
menuLinks.forEach(link => link.addEventListener('click', closeMenu));

document.querySelector('#booking-form')?.addEventListener('submit', event => {
  event.preventDefault();
  const name = new FormData(event.currentTarget).get('name');
  const message = document.querySelector('#form-message');
  message.textContent = `Thanks, ${name}. We’ll be in touch shortly.`;
  event.currentTarget.reset();
});

const events = document.querySelectorAll('.event');
events.forEach(event => event.addEventListener('mouseenter', () => {
  events.forEach(item => item.classList.remove('active'));
  event.classList.add('active');
}));
