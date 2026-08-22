const restaurants = [
  {
    id: 'hana', name: 'Hana Ramen House', category: 'Asian', rating: '4.8', time: '25–35 min', fee: '$0 delivery', tag: 'Top rated',
    image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=85',
    dish: { name: 'Miso butter ramen', description: 'Silky pork broth, roasted corn, nori, soft egg and spring onion.', price: 16.50, image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=1000&q=85' }
  },
  {
    id: 'margo', name: 'Margo’s Pizzeria', category: 'Pizza', rating: '4.9', time: '20–30 min', fee: '$1.49 delivery', tag: 'Free item',
    image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=900&q=85',
    dish: { name: 'Hot honey pepperoni', description: 'Stone-baked sourdough, mozzarella, cup pepperoni and chilli honey.', price: 18.00, image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=1000&q=85' }
  },
  {
    id: 'golden', name: 'Golden Hour Burger', category: 'Burgers', rating: '4.7', time: '25–35 min', fee: '$0 delivery', tag: '20% off',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=85',
    dish: { name: 'The golden smash', description: 'Two crisp-edged beef patties, American cheese, pickles and house sauce.', price: 15.50, image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1000&q=85' }
  },
  {
    id: 'mesa', name: 'Mesa Verde', category: 'Healthy', rating: '4.8', time: '20–30 min', fee: '$0 delivery', tag: 'New',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=85',
    dish: { name: 'Charred chicken bowl', description: 'Herby grains, avocado, seasonal greens, citrus chicken and tahini.', price: 14.75, image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1000&q=85' }
  },
  {
    id: 'melt', name: 'Melt & Co.', category: 'Desserts', rating: '4.6', time: '15–25 min', fee: '$1.49 delivery', tag: '2 for 1',
    image: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=900&q=85',
    dish: { name: 'Salted caramel cookie', description: 'Warm dark chocolate cookie with a molten salted caramel centre.', price: 6.50, image: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=1000&q=85' }
  },
  {
    id: 'sunroom', name: 'The Sunroom Cafe', category: 'Coffee', rating: '4.9', time: '10–20 min', fee: '$0 delivery', tag: 'Local favourite',
    image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=85',
    dish: { name: 'Maple oat latte', description: 'Double espresso, velvety oat milk and a little real maple.', price: 5.50, image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1000&q=85' }
  }
];

let currentCategory = 'All';
let searchTerm = '';
let selectedRestaurant = null;
let cart = [];

const $ = (selector) => document.querySelector(selector);
const restaurantGrid = $('#restaurantGrid');
const cartDrawer = $('#cartDrawer');
const overlay = $('#overlay');
const cartContents = $('#cartContents');
const cartFooter = $('#cartFooter');
const cartCount = $('#cartCount');
const dishDialog = $('#dishDialog');
const checkoutDialog = $('#checkoutDialog');

function money(value) { return `$${value.toFixed(2)}`; }

function getFilteredRestaurants() {
  return restaurants.filter((restaurant) => {
    const matchesCategory = currentCategory === 'All' || restaurant.category === currentCategory;
    const allText = `${restaurant.name} ${restaurant.category} ${restaurant.dish.name}`.toLowerCase();
    return matchesCategory && allText.includes(searchTerm.toLowerCase());
  });
}

function renderRestaurants() {
  const matches = getFilteredRestaurants();
  if (!matches.length) {
    restaurantGrid.innerHTML = `<div class="no-results"><span>🍽️</span><h3>Nothing quite matches that</h3><p>Try a dish, cuisine, or restaurant name.</p></div>`;
    return;
  }
  restaurantGrid.innerHTML = matches.map((restaurant) => `
    <article class="restaurant-card" data-id="${restaurant.id}" tabindex="0" aria-label="View ${restaurant.name}">
      <div class="restaurant-image"><img src="${restaurant.image}" alt="${restaurant.name} food" /><span class="restaurant-tag">${restaurant.tag}</span><button class="heart" type="button" aria-label="Save ${restaurant.name}">♡</button></div>
      <div class="restaurant-info"><div class="restaurant-title-line"><h3>${restaurant.name}</h3><span class="restaurant-rating"><span>★</span> ${restaurant.rating}</span></div><p>${restaurant.category} · ${restaurant.dish.name}</p><p class="delivery"><span>${restaurant.time}</span><i></i><span>${restaurant.fee}</span></p></div>
    </article>`).join('');
}

function showToast(message) {
  $('#toastText').textContent = message;
  $('#toast').classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => $('#toast').classList.remove('show'), 2600);
}

function syncCart() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  cartCount.textContent = count;
  renderCart();
}

function renderCart() {
  if (!cart.length) {
    cartContents.innerHTML = `<div class="empty-cart"><span class="empty-emoji">🛍️</span><h3>Your cart is empty</h3><p>Find something delicious, then come back here.</p></div>`;
    cartFooter.innerHTML = `<button class="dark-button checkout-button" id="emptyBrowse" type="button">Browse restaurants <span>→</span></button>`;
    $('#emptyBrowse').addEventListener('click', () => { closeCart(); $('#restaurantGrid').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
    return;
  }
  cartContents.innerHTML = cart.map((item, index) => `
    <div class="cart-item"><img src="${item.image}" alt="${item.name}"/><div><h3>${item.name}</h3><p>${item.restaurant}</p></div><div class="item-side"><strong>${money(item.price * item.quantity)}</strong><div class="quantity"><button type="button" data-change="-1" data-index="${index}" aria-label="Remove one">−</button><span>${item.quantity}</span><button type="button" data-change="1" data-index="${index}" aria-label="Add one">+</button></div></div></div>`).join('');
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const fee = subtotal >= 18 ? 0 : 1.49;
  const service = subtotal * .07;
  const total = subtotal + fee + service;
  cartFooter.innerHTML = `<div class="cart-summary"><div class="summary-row"><span>Subtotal</span><span>${money(subtotal)}</span></div><div class="summary-row"><span>Delivery</span><span>${fee ? money(fee) : 'Free'}</span></div><div class="summary-row"><span>Service fee</span><span>${money(service)}</span></div><div class="summary-row total"><span>Total</span><span>${money(total)}</span></div></div><button class="dark-button checkout-button" id="checkoutButton" type="button">Go to checkout <span>${money(total)} →</span></button>`;
  cartContents.querySelectorAll('[data-change]').forEach((button) => button.addEventListener('click', () => updateQuantity(Number(button.dataset.index), Number(button.dataset.change))));
  $('#checkoutButton').addEventListener('click', openCheckout);
}

function addToCart(restaurant) {
  const existing = cart.find((item) => item.restaurantId === restaurant.id);
  if (existing) existing.quantity += 1;
  else cart.push({ restaurantId: restaurant.id, restaurant: restaurant.name, name: restaurant.dish.name, price: restaurant.dish.price, image: restaurant.dish.image, quantity: 1 });
  syncCart();
  showToast(`${restaurant.dish.name} added to your order`);
}

function updateQuantity(index, delta) {
  cart[index].quantity += delta;
  if (cart[index].quantity < 1) cart.splice(index, 1);
  syncCart();
}

function openCart() { overlay.classList.add('visible'); cartDrawer.classList.add('open'); cartDrawer.setAttribute('aria-hidden', 'false'); }
function closeCart() { overlay.classList.remove('visible'); cartDrawer.classList.remove('open'); cartDrawer.setAttribute('aria-hidden', 'true'); }

function openDish(restaurant) {
  selectedRestaurant = restaurant;
  $('#dialogImage').src = restaurant.dish.image;
  $('#dialogImage').alt = restaurant.dish.name;
  $('#dialogRestaurant').textContent = restaurant.name;
  $('#dialogTitle').textContent = restaurant.dish.name;
  $('#dialogDescription').textContent = restaurant.dish.description;
  $('#dialogPrice').textContent = money(restaurant.dish.price);
  dishDialog.showModal();
}

function closeDialog(dialog) { if (dialog.open) dialog.close(); }

function openCheckout() {
  closeCart();
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const fee = subtotal >= 18 ? 0 : 1.49;
  const service = subtotal * .07;
  const total = subtotal + fee + service;
  $('#checkoutContents').innerHTML = `<p class="eyebrow">ALMOST THERE</p><h2>Review your order</h2><p>Everything looks good. This is a demo checkout — no payment will be taken.</p><div class="checkout-address"><span>⌂</span><div><strong>Deliver to 18 Ruskin St</strong><small>Apt 3B · Leave at door</small></div></div><div class="payment-row"><span class="payment-card">•••• 4242</span><span>Demo payment card</span></div><button class="dark-button confirm-order" id="confirmOrder" type="button">Place demo order <span>${money(total)} →</span></button>`;
  checkoutDialog.showModal();
  $('#confirmOrder').addEventListener('click', confirmOrder);
}

function confirmOrder() {
  const orderNumber = `SB-${Math.floor(1000 + Math.random() * 8999)}`;
  $('#checkoutContents').innerHTML = `<div class="confirmation"><div class="big-check">✓</div><p class="eyebrow">ORDER CONFIRMED</p><h2>It’s in the kitchen.</h2><p>Your order has been sent to the restaurant. We’ll let you know when it’s on the way.</p><span class="order-pill">Order ${orderNumber} · Arrives in 25–35 min</span><div class="track-stage"><strong>Hana is accepting your order</strong><div class="progress"><i></i></div><small>We’ll update your delivery status here.</small></div><button class="dark-button track-button" id="doneButton" type="button">Back to browsing <span>→</span></button></div>`;
  cart = [];
  syncCart();
  $('#doneButton').addEventListener('click', () => { closeDialog(checkoutDialog); window.scrollTo({ top: 0, behavior: 'smooth' }); });
}

$('#categoryRow').addEventListener('click', (event) => {
  const button = event.target.closest('.category-card');
  if (!button) return;
  currentCategory = button.dataset.category;
  document.querySelectorAll('.category-card').forEach((item) => item.classList.toggle('active', item === button));
  renderRestaurants();
  $('#restaurantGrid').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

restaurantGrid.addEventListener('click', (event) => {
  if (event.target.closest('.heart')) { const heart = event.target.closest('.heart'); heart.textContent = heart.textContent === '♡' ? '♥' : '♡'; heart.style.color = heart.textContent === '♥' ? '#d85a73' : ''; return; }
  const card = event.target.closest('.restaurant-card');
  if (card) openDish(restaurants.find((restaurant) => restaurant.id === card.dataset.id));
});
restaurantGrid.addEventListener('keydown', (event) => { if (event.key === 'Enter') { const card = event.target.closest('.restaurant-card'); if (card) openDish(restaurants.find((restaurant) => restaurant.id === card.dataset.id)); } });

$('#foodSearch').addEventListener('input', (event) => { searchTerm = event.target.value.trim(); renderRestaurants(); });
$('#foodSearch').addEventListener('keydown', (event) => { if (event.key === 'Enter' && getFilteredRestaurants().length) openDish(getFilteredRestaurants()[0]); });
document.addEventListener('keydown', (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); $('#foodSearch').focus(); } if (event.key === 'Escape') closeCart(); });
$('#cartButton').addEventListener('click', openCart);
overlay.addEventListener('click', closeCart);
document.querySelectorAll('.close-panel').forEach((button) => button.addEventListener('click', closeCart));
document.querySelectorAll('.dialog-close').forEach((button) => button.addEventListener('click', () => closeDialog(button.closest('dialog'))));
$('#dialogAdd').addEventListener('click', () => { if (selectedRestaurant) addToCart(selectedRestaurant); closeDialog(dishDialog); openCart(); });
$('#browseButton').addEventListener('click', () => $('#restaurantGrid').scrollIntoView({ behavior: 'smooth', block: 'start' }));
$('#viewAll').addEventListener('click', () => { currentCategory = 'All'; document.querySelectorAll('.category-card').forEach((item) => item.classList.toggle('active', item.dataset.category === 'All')); renderRestaurants(); $('#restaurantGrid').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
$('#seeAllCategories').addEventListener('click', () => $('#categoryRow').scrollIntoView({ behavior: 'smooth', block: 'center' }));
$('#locationButton').addEventListener('click', () => showToast('Your delivery address is set to 18 Ruskin St'));

renderRestaurants();
syncCart();
