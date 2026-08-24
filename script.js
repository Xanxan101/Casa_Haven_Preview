// Casa Haven — static export logic
import { fetchAvailabilityMap, dateKey } from './availability.js';
import { fetchRates, formatPeso } from './rates.js';

document.addEventListener('DOMContentLoaded', () => {
  const pages = document.querySelectorAll('.page[data-page]');
  const navLinks = document.querySelectorAll('a[data-nav]');

  // Shared hero + nav background stage — sized to span nav + hero combined,
  // so both sections read as windows onto the same photo instead of separate crops.
  const heroBgStage = document.getElementById('hero-bg-stage');
  const heroEl = document.querySelector('.hero');
  const navEl = document.querySelector('.nav');
  function syncHeroBgStage() {
    if (!heroBgStage || !heroEl || !navEl) return;
    heroBgStage.style.height = `${navEl.offsetHeight + heroEl.offsetHeight}px`;
  }
  window.addEventListener('resize', syncHeroBgStage);

  const promosSection = document.querySelector('[data-page="promos"]');
  const footerEl = document.querySelector('.site-footer');
  function syncPromosHeight() {
    if (!promosSection || !navEl || !footerEl) return;
    if (!window.matchMedia('(min-width: 1025px)').matches) {
      promosSection.style.minHeight = '';
      return;
    }
    promosSection.style.minHeight = '';
    const available = window.innerHeight - navEl.offsetHeight - footerEl.offsetHeight;
    promosSection.style.minHeight = available > 0 ? `${available}px` : '';
  }
  window.addEventListener('resize', syncPromosHeight);
  if (window.ResizeObserver) {
    const promosResizeObserver = new ResizeObserver(syncPromosHeight);
    if (navEl) promosResizeObserver.observe(navEl);
    if (footerEl) promosResizeObserver.observe(footerEl);
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(syncPromosHeight);
  }

  const pageFadePlayed = {};
  function playPageFade(page) {
    if (pageFadePlayed[page]) return;
    pageFadePlayed[page] = true;
    const fadeEls = document.querySelectorAll(`[data-page="${page}"] .page-fade, [data-page="${page}"] .fade-in`);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fadeEls.forEach((el, i) => {
          el.style.transitionDelay = `${i * 60}ms`;
          el.classList.add('is-visible');
        });
      });
    });
  }

  // Keeps the current page in the URL hash (#booking, #facilities, ...) so a
  // refresh reopens the same page instead of always bouncing back to home.
  const validPages = new Set(Array.from(pages).map(p => p.dataset.page));

  function goTo(page, { updateHash = true } = {}) {
    pages.forEach(p => p.hidden = p.dataset.page !== page);
    navLinks.forEach(a => a.classList.toggle('active', a.dataset.nav === page));
    if (heroBgStage) heroBgStage.classList.toggle('visible', page === 'home');
    if (page === 'home') syncHeroBgStage();
    if (page === 'promos') syncPromosHeight();
    if (page === 'facilities' || page === 'services' || page === 'highlights') playPageFade(page);
    if (updateHash) {
      const url = page === 'home' ? `${location.pathname}${location.search}` : `${location.pathname}${location.search}#${page}`;
      history.replaceState(null, '', url);
    }
    window.scrollTo(0, 0);
  }

  navLinks.forEach(a => a.addEventListener('click', (e) => {
    e.preventDefault();
    goTo(a.dataset.nav);
  }));
  document.querySelectorAll('[data-goto]').forEach(el => el.addEventListener('click', () => goTo(el.dataset.goto)));

  const hashPage = location.hash.slice(1);
  goTo(validPages.has(hashPage) ? hashPage : 'home', { updateHash: false });

  // Nav + hero entrance fade-in, plays once on first load
  const heroFadeEls = document.querySelectorAll('.hero-fade');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      heroFadeEls.forEach((el, i) => {
        el.style.transitionDelay = `${i * 70}ms`;
        el.classList.add('is-visible');
      });
    });
  });

  // Navigation drawer (mobile / tablet)
  const navToggle = document.getElementById('nav-toggle');
  const navClose = document.getElementById('nav-close');
  const navDrawer = document.getElementById('nav-drawer');
  const navOverlay = document.getElementById('nav-overlay');

  function openDrawer() {
    navDrawer.classList.add('open');
    navOverlay.classList.add('open');
    navToggle.setAttribute('aria-expanded', 'true');
    document.body.classList.add('no-scroll');
  }
  function closeDrawer() {
    navDrawer.classList.remove('open');
    navOverlay.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('no-scroll');
  }

  if (navToggle && navDrawer && navOverlay) {
    navToggle.addEventListener('click', openDrawer);
    navClose.addEventListener('click', closeDrawer);
    navOverlay.addEventListener('click', closeDrawer);
    navDrawer.querySelectorAll('a[data-nav]').forEach(a => a.addEventListener('click', closeDrawer));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDrawer();
    });
  }

  // Guest reviews
  const testimonials = [
    { quote: 'Super cozy and exactly like the photos. Easy check-in and great WiFi for work calls.', name: 'Maria S.' },
    { quote: 'Walking distance to MOA and the pool access made our weekend feel like a real vacation.', name: 'Jon R.' },
    { quote: 'Clean, quiet, and the host replied fast on Messenger. Will book again.', name: 'Angela T.' },
    { quote: 'Great value for a group stay — spacious enough for four and close to everything.', name: 'Paul D.' },
    { quote: 'Spotless unit, stunning view, and the pool access was the perfect bonus for the kids.', name: 'Reia L.' },
  ];
  const CENTER_SLOT = Math.floor(testimonials.length / 2);
  const grid = document.getElementById('reviews-grid');
  if (grid) {
    grid.innerHTML = testimonials.map(t => `
      <div class="review-card">
        <div class="review-photo">Guest photo</div>
        <div class="review-body">
          <p class="review-quote">"${t.quote}"</p>
          <p class="review-name">— ${t.name}</p>
        </div>
      </div>`).join('');
  }
  const reviewsCarousel = document.querySelector('.reviews-carousel');
  const reviewPrevBtn = document.getElementById('review-prev');
  const reviewNextBtn = document.getElementById('review-next');

  // Reviews carousel — sliding track (same technique as Marsh Bites' testimonial-slider.js):
  // translateX is computed to keep the active card centered instead of reordering cards.
  if (grid && reviewsCarousel && testimonials.length) {
    const reviewCards = grid.querySelectorAll('.review-card');
    const N = testimonials.length;
    let reviewIndex = CENTER_SLOT % N;
    const isDesktopCarousel = () => window.matchMedia('(min-width: 1025px)').matches;

    const updateReviewsCarousel = () => {
      reviewCards.forEach((card, i) => card.classList.toggle('active', i === reviewIndex));
      if (!isDesktopCarousel()) {
        grid.style.transform = '';
        return;
      }
      const card = reviewCards[reviewIndex];
      const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
      const slotWidth = card.offsetWidth + gap;
      const offset = (reviewsCarousel.offsetWidth / 2) - (card.offsetWidth / 2) - (reviewIndex * slotWidth);
      grid.style.transform = `translateX(${offset}px)`;
    };

    const setActiveReview = (index) => {
      reviewIndex = (index + N) % N;
      updateReviewsCarousel();
    };

    if (reviewPrevBtn) reviewPrevBtn.addEventListener('click', () => setActiveReview(reviewIndex - 1));
    if (reviewNextBtn) reviewNextBtn.addEventListener('click', () => setActiveReview(reviewIndex + 1));
    window.addEventListener('resize', updateReviewsCarousel);

    setActiveReview(reviewIndex);
  }

  // Photo category cards — image + label/arrow footer; click opens the
  // lightbox scoped to that category's photos, navigable left/right.
  // Shared by the Suite page and the Services page photo grids.
  const suiteCategories = [
    { name: 'Entryway', images: ['s12.webp'] },
    { name: 'Living Area', images: ['s13.webp', 's14.webp'] },
    { name: 'Dining Nook', images: ['s1.webp'] },
    { name: 'Kitchen', images: ['s6.webp', 's9.webp'] },
    { name: 'Bedroom', images: ['s11.webp', 's2.webp', 's10.webp'] },
    { name: 'Bathroom', images: ['s5.webp', 's7.webp'] },
    { name: 'Balcony View', images: ['s3.webp', 's4.webp', 's8.webp'] },
  ];
  const servicesCategories = [
    { name: 'Pool Area', images: ['pool_area_1.webp', 'pool_area_2.webp', 'pool_area_3.webp'] },
    { name: 'Reception Lounge', images: ['reception_lounge_1.webp', 'reception_lounge_2.webp'] },
  ];

  function renderPhotoCategoryGrid(gridEl, categories, altPrefix, fadeClass) {
    if (!gridEl) return;
    gridEl.innerHTML = categories.map(({ name, images }, i) => `
      <div class="suite-photo-card ${fadeClass}" data-category-index="${i}">
        <div class="suite-photo-card-image"><img src="assets/${images[0]}" alt="${altPrefix} — ${name}" loading="lazy"></div>
        <div class="suite-photo-card-footer">
          <span class="suite-photo-card-label">${name}</span>
          <span class="suite-photo-card-arrow" aria-hidden="true">&rarr;</span>
        </div>
      </div>`).join('');
    gridEl.addEventListener('click', (e) => {
      const card = e.target.closest('.suite-photo-card');
      if (!card) return;
      const category = categories[Number(card.dataset.categoryIndex)];
      if (category) openLightbox(category.images, category.name);
    });
  }

  // Lightbox — enlarges the clicked category's photos with prev/next navigation
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxClose = document.getElementById('lightbox-close');
  const lightboxPrev = document.getElementById('lightbox-prev');
  const lightboxNext = document.getElementById('lightbox-next');
  const lightboxCaption = document.getElementById('lightbox-caption');
  let lightboxImages = [];
  let lightboxName = '';
  let lightboxIndex = 0;

  function renderLightboxImage() {
    lightboxImg.src = `assets/${lightboxImages[lightboxIndex]}`;
    lightboxImg.alt = lightboxName;
    if (lightboxCaption) {
      lightboxCaption.textContent = lightboxImages.length > 1
        ? `${lightboxName} — ${lightboxIndex + 1}/${lightboxImages.length}`
        : lightboxName;
    }
    const multiple = lightboxImages.length > 1;
    if (lightboxPrev) lightboxPrev.hidden = !multiple;
    if (lightboxNext) lightboxNext.hidden = !multiple;
  }
  function openLightbox(images, name) {
    if (!lightbox || !lightboxImg) return;
    lightboxImages = images;
    lightboxName = name;
    lightboxIndex = 0;
    renderLightboxImage();
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
  }
  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
  }
  function stepLightbox(delta) {
    if (!lightboxImages.length) return;
    lightboxIndex = (lightboxIndex + delta + lightboxImages.length) % lightboxImages.length;
    renderLightboxImage();
  }

  renderPhotoCategoryGrid(document.getElementById('suite-photos-grid'), suiteCategories, 'Casa Haven suite', 'fade-in');
  renderPhotoCategoryGrid(document.getElementById('services-photos-grid'), servicesCategories, 'Casa Haven', 'page-fade');

  if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
  if (lightboxPrev) lightboxPrev.addEventListener('click', (e) => { e.stopPropagation(); stepLightbox(-1); });
  if (lightboxNext) lightboxNext.addEventListener('click', (e) => { e.stopPropagation(); stepLightbox(1); });
  if (lightbox) {
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
    if (!lightbox || !lightbox.classList.contains('open')) return;
    if (e.key === 'ArrowLeft') stepLightbox(-1);
    if (e.key === 'ArrowRight') stepLightbox(1);
  });

  // Calendar — navigable across a 3-month window (the listing month + 2 ahead)
  const calendar = document.getElementById('calendar');
  if (calendar) {
    const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const todayDate = new Date();
    const todayMidnight = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
    const baseYear = todayDate.getFullYear(), baseMonth = todayDate.getMonth(); // real "today" — first month of the 3-month window
    const calendarMonthLabel = document.getElementById('calendar-month-label');
    const calendarPrevBtn = document.getElementById('calendar-prev');
    const calendarNextBtn = document.getElementById('calendar-next');
    const calendarTodayBtn = document.getElementById('calendar-today');
    let calendarOffset = 0; // 0–2: how many months past the base we're viewing
    // { 'YYYY-MM-DD': 'booked' | 'closed' } — same live data the owner/staff
    // consoles write to, so a date marked there shows here too.
    let calendarAvailability = {};

    function renderPublicCalendar() {
      const first = new Date(baseYear, baseMonth + calendarOffset, 1);
      const year = first.getFullYear();
      const month = first.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstWeekday = first.getDay();
      let html = weekdayLabels.map(l => `<div class="cal-label">${l}</div>`).join('');
      for (let i = 0; i < firstWeekday; i++) html += `<div class="cal-cell"></div>`;
      for (let d = 1; d <= daysInMonth; d++) {
        const cellDate = new Date(year, month, d);
        const isPast = cellDate < todayMidnight;
        // Booked and closed both just mean "can't book this" to a guest — no
        // need to distinguish why, so both collapse to the one closed state.
        const status = calendarAvailability[dateKey(cellDate)];
        const unavailable = !isPast && (status === 'booked' || status === 'closed');
        const stateClass = isPast ? ' cal-cell-past' : unavailable ? ' cal-cell-closed' : '';
        const title = unavailable ? ' title="Closed"' : '';
        const icon = unavailable
          ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="5" y1="5" x2="19" y2="19"></line><line x1="19" y1="5" x2="5" y2="19"></line></svg>'
          : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b6b6b" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        html += `<div class="cal-cell${stateClass}"${title}>${d}${icon}</div>`;
      }
      calendar.innerHTML = html;
      if (calendarMonthLabel) calendarMonthLabel.textContent = `${monthNames[month]} ${year}`;
      if (calendarPrevBtn) calendarPrevBtn.disabled = calendarOffset <= 0;
      if (calendarNextBtn) calendarNextBtn.disabled = calendarOffset >= 2;
    }
    if (calendarPrevBtn) {
      calendarPrevBtn.addEventListener('click', () => {
        if (calendarOffset <= 0) return;
        calendarOffset -= 1;
        renderPublicCalendar();
      });
    }
    if (calendarNextBtn) {
      calendarNextBtn.addEventListener('click', () => {
        if (calendarOffset >= 2) return;
        calendarOffset += 1;
        renderPublicCalendar();
      });
    }
    if (calendarTodayBtn) {
      calendarTodayBtn.addEventListener('click', () => {
        calendarOffset = 0;
        renderPublicCalendar();
      });
    }
    renderPublicCalendar();
    fetchAvailabilityMap().then(map => {
      calendarAvailability = map;
      renderPublicCalendar();
    });
  }

  // Stay Rates / Pool Access tables — filled in from whatever the owner last
  // saved in Rates & rules; falls back to the numbers already in the markup
  // if Firestore is unreachable.
  const rateCellIds = {
    guests2Weekday: 'rate-guests2-weekday', guests2Weekend: 'rate-guests2-weekend',
    guests34Weekday: 'rate-guests34-weekday', guests34Weekend: 'rate-guests34-weekend',
    poolWeekday: 'rate-pool-weekday', poolWeekend: 'rate-pool-weekend',
  };
  fetchRates().then(rates => {
    Object.entries(rateCellIds).forEach(([key, id]) => {
      const cell = document.getElementById(id);
      if (!cell) return;
      const suffix = id.startsWith('rate-pool-') ? ' per person' : '';
      cell.textContent = `${formatPeso(rates[key])}${suffix}`;
    });
  });

  // Booking form
  const bookingForm = document.getElementById('booking-form');
  if (bookingForm) {
    const checkinInput = bookingForm.querySelector('input[name="checkin"]');
    const checkoutInput = bookingForm.querySelector('input[name="checkout"]');
    const guestsInput = bookingForm.querySelector('input[name="guests"]');
    const dateError = document.getElementById('booking-date-error');

    if (guestsInput) {
      guestsInput.addEventListener('input', () => {
        if (Number(guestsInput.value) > 4) guestsInput.value = '4';
      });
    }

    function nextDay(dateValue) {
      const d = new Date(dateValue + 'T00:00:00');
      d.setDate(d.getDate() + 1);
      return d.toISOString().slice(0, 10);
    }

    // Past dates aren't selectable for either field — local date, not UTC,
    // so this matches what "today" means to whoever is actually booking.
    function todayStr() {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    if (checkinInput) checkinInput.min = todayStr();
    if (checkoutInput) checkoutInput.min = todayStr();

    function validateDates() {
      const valid = !checkinInput.value || !checkoutInput.value || checkoutInput.value > checkinInput.value;
      dateError.hidden = valid;
      checkoutInput.setCustomValidity(valid ? '' : 'Check-out must be at least one day after check-in.');
      return valid;
    }

    if (checkinInput && checkoutInput && dateError) {
      checkinInput.addEventListener('change', () => {
        checkoutInput.min = checkinInput.value ? nextDay(checkinInput.value) : todayStr();
        validateDates();
      });
      checkoutInput.addEventListener('change', validateDates);
    }

    bookingForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (checkinInput && checkoutInput && dateError && !validateDates()) return;
      const data = Object.fromEntries(new FormData(bookingForm));
      document.getElementById('booking-form-wrap').hidden = true;
      document.getElementById('booking-confirm').hidden = false;
      document.getElementById('booking-thanks').textContent = `Thanks, ${data.name}!`;
      document.getElementById('booking-summary').textContent =
        `Name: ${data.name}\nContact: ${data.contact}\nCheck-in: ${data.checkin || '—'}\nCheck-out: ${data.checkout || '—'}\nGuests: ${data.guests}` +
        (data.email ? `\nEmail: ${data.email}` : '') +
        (data.promoCode ? `\nPromo code: ${data.promoCode}` : '') +
        (data.message ? `\nNote: ${data.message}` : '');
    });

    // "Send Inquiry" opens the Terms & Conditions modal instead of submitting
    // directly — the actual submission only happens from the modal's own
    // Send Inquiry button, which stays disabled until the guest checks agree.
    const bookingOpenTosBtn = document.getElementById('booking-open-tos');
    const tosModal = document.getElementById('tos-modal');
    const tosModalClose = document.getElementById('tos-modal-close');
    const tosAgreeCheckbox = document.getElementById('tos-agree-checkbox');
    const tosConfirmBtn = document.getElementById('tos-confirm-btn');

    function openTosModal() {
      if (!tosModal) return;
      if (tosAgreeCheckbox) tosAgreeCheckbox.checked = false;
      if (tosConfirmBtn) tosConfirmBtn.disabled = true;
      tosModal.classList.add('open');
      tosModal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('no-scroll');
    }
    function closeTosModal() {
      if (!tosModal) return;
      tosModal.classList.remove('open');
      tosModal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('no-scroll');
    }
    if (bookingOpenTosBtn) {
      bookingOpenTosBtn.addEventListener('click', () => {
        // Reuses native required-field validation so empty fields still get
        // flagged before we bother showing the terms.
        if (!bookingForm.reportValidity()) return;
        openTosModal();
      });
    }
    if (tosAgreeCheckbox && tosConfirmBtn) {
      tosAgreeCheckbox.addEventListener('change', () => {
        tosConfirmBtn.disabled = !tosAgreeCheckbox.checked;
      });
    }
    if (tosConfirmBtn) {
      tosConfirmBtn.addEventListener('click', () => {
        closeTosModal();
        bookingForm.requestSubmit();
      });
    }
    if (tosModalClose) tosModalClose.addEventListener('click', closeTosModal);
    if (tosModal) {
      tosModal.addEventListener('click', (e) => {
        if (e.target === tosModal) closeTosModal();
      });
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && tosModal && tosModal.classList.contains('open')) closeTosModal();
    });
    const bookingEditBtn = document.getElementById('booking-edit');
    if (bookingEditBtn) {
      bookingEditBtn.addEventListener('click', () => {
        document.getElementById('booking-form-wrap').hidden = false;
        document.getElementById('booking-confirm').hidden = true;
      });
    }
  }

  // Message word limit (booking + contact forms)
  const MAX_MESSAGE_WORDS = 200;
  function setupMessageWordLimit(textarea) {
    if (!textarea) return;
    textarea.addEventListener('input', () => {
      const words = [...textarea.value.matchAll(/\S+/g)];
      if (words.length > MAX_MESSAGE_WORDS) {
        textarea.value = textarea.value.slice(0, words[MAX_MESSAGE_WORDS].index);
      }
    });
  }
  setupMessageWordLimit(document.querySelector('#booking-form textarea[name="message"]'));
  setupMessageWordLimit(document.querySelector('#contact-form textarea[name="message"]'));

  // Contact form
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
    });
  }

  const copyright = document.getElementById('copyright');
  if (copyright) copyright.textContent = `© ${new Date().getFullYear()} Casa Haven. All rights reserved.`;

  // Scroll-to-top button — shows once the nav bar scrolls out of view
  const scrollTopBtn = document.getElementById('scroll-top');
  if (scrollTopBtn && navEl) {
    const navObserver = new IntersectionObserver(([entry]) => {
      scrollTopBtn.classList.toggle('visible', !entry.isIntersecting);
    });
    navObserver.observe(navEl);
    scrollTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // About Us text — fade up once when scrolled into view
  const aboutTextFade = document.querySelector('.about-text-fade');
  if (aboutTextFade) {
    const aboutFadeObserver = new IntersectionObserver(([entry], observer) => {
      if (entry.isIntersecting) {
        aboutTextFade.classList.add('is-visible');
        observer.disconnect();
      }
    }, { threshold: 0.25 });
    aboutFadeObserver.observe(aboutTextFade);
  }

  // About Us photo — wipes in once scrolled into view. Observes .about-grid rather than
  // the photo itself, since the photo's own clip-path (used for the wipe) reads as zero-area
  // to IntersectionObserver and would never report as intersecting.
  const aboutPhotoFade = document.querySelector('.about-photo-fade');
  const aboutPhotoTrigger = document.querySelector('.about-grid');
  if (aboutPhotoFade && aboutPhotoTrigger) {
    const aboutPhotoObserver = new IntersectionObserver(([entry], observer) => {
      if (entry.isIntersecting) {
        aboutPhotoFade.classList.add('is-visible');
        observer.disconnect();
      }
    }, { threshold: 0.25 });
    aboutPhotoObserver.observe(aboutPhotoTrigger);
  }

  // Hero background — cross-fade cycle (nav is transparent and shares this same layer)
  const heroBgLayers = document.querySelectorAll('.hero-bg-layer');
  if (heroBgLayers.length > 1) {
    let bgIndex = 0;
    setInterval(() => {
      heroBgLayers[bgIndex].classList.remove('active');
      bgIndex = (bgIndex + 1) % heroBgLayers.length;
      heroBgLayers[bgIndex].classList.add('active');
    }, 3000);
  }
});
