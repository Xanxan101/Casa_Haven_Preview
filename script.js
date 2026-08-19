// Casa Haven — static export logic
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

  // Promos page — stretch the section so a short "no promos" state still
  // pushes the footer down to the bottom of the viewport (desktop only).
  const promosSection = document.querySelector('[data-page="promos"]');
  const footerEl = document.querySelector('.site-footer');
  function syncPromosHeight() {
    if (!promosSection || !navEl || !footerEl) return;
    if (!window.matchMedia('(min-width: 1025px)').matches) {
      promosSection.style.minHeight = '';
      return;
    }
    // Reset first so a previously-set min-height can't itself skew the
    // nav/footer measurements below (e.g. via scrollbar width changes).
    promosSection.style.minHeight = '';
    const available = window.innerHeight - navEl.offsetHeight - footerEl.offsetHeight;
    promosSection.style.minHeight = available > 0 ? `${available}px` : '';
  }
  window.addEventListener('resize', syncPromosHeight);
  // Nav/footer height can shift after web fonts swap in or content wraps
  // differently — keep the promos section in sync whenever that happens.
  if (window.ResizeObserver) {
    const promosResizeObserver = new ResizeObserver(syncPromosHeight);
    if (navEl) promosResizeObserver.observe(navEl);
    if (footerEl) promosResizeObserver.observe(footerEl);
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(syncPromosHeight);
  }

  // Facilities & Services pages — fade up all content once, the first time each page is opened
  const pageFadePlayed = {};
  function playPageFade(page) {
    if (pageFadePlayed[page]) return;
    pageFadePlayed[page] = true;
    const fadeEls = document.querySelectorAll(`[data-page="${page}"] .page-fade`);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fadeEls.forEach((el, i) => {
          el.style.transitionDelay = `${i * 60}ms`;
          el.classList.add('is-visible');
        });
      });
    });
  }

  function goTo(page) {
    pages.forEach(p => p.hidden = p.dataset.page !== page);
    navLinks.forEach(a => a.classList.toggle('active', a.dataset.nav === page));
    if (heroBgStage) heroBgStage.classList.toggle('visible', page === 'home');
    if (page === 'home') syncHeroBgStage();
    if (page === 'promos') syncPromosHeight();
    if (page === 'facilities' || page === 'services') playPageFade(page);
    if (page === 'highlights' && refreshSuitePhotosCarousel) refreshSuitePhotosCarousel();
    window.scrollTo(0, 0);
  }

  navLinks.forEach(a => a.addEventListener('click', (e) => {
    e.preventDefault();
    goTo(a.dataset.nav);
  }));
  document.querySelectorAll('[data-goto]').forEach(el => el.addEventListener('click', () => goTo(el.dataset.goto)));

  goTo('home');

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

  // Suite photos carousel — same sliding-track technique as the guest reviews carousel
  const suitePhotoCount = 14;
  const suitePhotosGrid = document.getElementById('suite-photos-grid');
  if (suitePhotosGrid) {
    suitePhotosGrid.innerHTML = Array.from({ length: suitePhotoCount }, (_, i) => i + 1).map(n => `
      <div class="suite-photo-card">
        <img src="assets/s${n}.webp" alt="Casa Haven suite photo ${n}" loading="lazy">
      </div>`).join('');
  }
  // Suite photos — click any card to view it larger/uncropped in a lightbox
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxClose = document.getElementById('lightbox-close');
  function openLightbox(src, alt) {
    if (!lightbox || !lightboxImg) return;
    lightboxImg.src = src;
    lightboxImg.alt = alt || '';
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
  if (suitePhotosGrid) {
    suitePhotosGrid.addEventListener('click', (e) => {
      const img = e.target.closest('.suite-photo-card img');
      if (img) openLightbox(img.src, img.alt);
    });
  }
  if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
  if (lightbox) {
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });

  const suitePhotosCarousel = suitePhotosGrid ? suitePhotosGrid.closest('.reviews-carousel') : null;
  const suitePhotoPrevBtn = document.getElementById('suite-photo-prev');
  const suitePhotoNextBtn = document.getElementById('suite-photo-next');
  // Assigned below when the carousel initializes — the highlights page starts
  // `hidden`, so widths measured at init time are 0 and must be re-synced
  // once the page is actually shown (see goTo()).
  let refreshSuitePhotosCarousel = null;

  if (suitePhotosGrid && suitePhotosCarousel && suitePhotoCount) {
    const suitePhotoCards = suitePhotosGrid.querySelectorAll('.suite-photo-card');
    const N = suitePhotoCount;
    let suitePhotoIndex = 0;
    const isDesktopSuiteCarousel = () => window.matchMedia('(min-width: 1025px)').matches;

    const updateSuitePhotosCarousel = () => {
      suitePhotoCards.forEach((card, i) => card.classList.toggle('active', i === suitePhotoIndex));
      if (!isDesktopSuiteCarousel()) {
        suitePhotosGrid.style.transform = '';
        return;
      }
      const card = suitePhotoCards[suitePhotoIndex];
      const gap = parseFloat(getComputedStyle(suitePhotosGrid).columnGap) || 0;
      const slotWidth = card.offsetWidth + gap;
      const offset = (suitePhotosCarousel.offsetWidth / 2) - (card.offsetWidth / 2) - (suitePhotoIndex * slotWidth);
      suitePhotosGrid.style.transform = `translateX(${offset}px)`;
    };

    const setActiveSuitePhoto = (index) => {
      suitePhotoIndex = (index + N) % N;
      updateSuitePhotosCarousel();
    };

    if (suitePhotoPrevBtn) suitePhotoPrevBtn.addEventListener('click', () => setActiveSuitePhoto(suitePhotoIndex - 1));
    if (suitePhotoNextBtn) suitePhotoNextBtn.addEventListener('click', () => setActiveSuitePhoto(suitePhotoIndex + 1));
    window.addEventListener('resize', updateSuitePhotosCarousel);

    refreshSuitePhotosCarousel = updateSuitePhotosCarousel;
    setActiveSuitePhoto(suitePhotoIndex);
  }

  // Calendar — July 2026
  const calendar = document.getElementById('calendar');
  if (calendar) {
    const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const year = 2026, month = 6; // July
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstWeekday = new Date(year, month, 1).getDay();
    let html = weekdayLabels.map(l => `<div class="cal-label">${l}</div>`).join('');
    for (let i = 0; i < firstWeekday; i++) html += `<div class="cal-cell"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      html += `<div class="cal-cell">${d}<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b6b6b" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg></div>`;
    }
    calendar.innerHTML = html;
  }

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

    function validateDates() {
      const valid = !checkinInput.value || !checkoutInput.value || checkoutInput.value > checkinInput.value;
      dateError.hidden = valid;
      checkoutInput.setCustomValidity(valid ? '' : 'Check-out must be at least one day after check-in.');
      return valid;
    }

    if (checkinInput && checkoutInput && dateError) {
      checkinInput.addEventListener('change', () => {
        checkoutInput.min = checkinInput.value ? nextDay(checkinInput.value) : '';
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
        (data.message ? `\nNote: ${data.message}` : '');
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

  // About Us photo — slide in from the left once when scrolled into view
  const aboutPhotoFade = document.querySelector('.about-photo-fade');
  if (aboutPhotoFade) {
    const aboutPhotoObserver = new IntersectionObserver(([entry], observer) => {
      if (entry.isIntersecting) {
        aboutPhotoFade.classList.add('is-visible');
        observer.disconnect();
      }
    }, { threshold: 0.25 });
    aboutPhotoObserver.observe(aboutPhotoFade);
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
