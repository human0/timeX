/**
 * AI Job Hunt consultation booking UI
 */
(function () {
    const API_BASE = 'https://tbserver-1059280513734.africa-south1.run.app';
    const PENDING_BOOKING_KEY = 'jobHuntPendingBooking';
    const CHECKOUT_URL_KEY = 'jobHuntCheckoutUrl';

    const state = {
        weekStart: startOfWeek(new Date()),
        selectedSlot: null,
        bookingId: null,
        pollTimer: null,
        priceZar: 800,
        availabilitySlots: null,
    };

    const els = {};

    function startOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        d.setDate(d.getDate() + diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function addDays(date, days) {
        const d = new Date(date);
        d.setDate(d.getDate() + days);
        return d;
    }

    function toIsoUtc(date) {
        return date.toISOString();
    }

    function getHashParams() {
        const hash = window.location.hash.slice(1);
        const queryIndex = hash.indexOf('?');
        if (queryIndex === -1) return new URLSearchParams();
        return new URLSearchParams(hash.slice(queryIndex + 1));
    }

    function formatSlotLabel(isoStart, isoEnd) {
        const start = new Date(isoStart);
        const end = new Date(isoEnd);
        const datePart = start.toLocaleDateString(undefined, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
        const timePart = `${start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
        return `${datePart}, ${timePart}`;
    }

    function formatWeekLabel(weekStart) {
        const weekEnd = addDays(weekStart, 6);
        const startMonth = weekStart.toLocaleDateString(undefined, { month: 'short' });
        const endMonth = weekEnd.toLocaleDateString(undefined, { month: 'short' });
        const year = weekEnd.getFullYear();
        if (startMonth === endMonth) {
            return `${weekStart.getDate()} – ${weekEnd.getDate()} ${startMonth} ${year}`;
        }
        return `${weekStart.getDate()} ${startMonth} – ${weekEnd.getDate()} ${endMonth} ${year}`;
    }

    const CALENDAR_TIME_ROWS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];

    function isSameCalendarDay(a, b) {
        return (
            a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate()
        );
    }

    function slotLookupKey(date, timeLabel) {
        const [hours, minutes] = timeLabel.split(':').map(Number);
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${hours}:${String(minutes).padStart(2, '0')}`;
    }

    function indexSlotsByCell(slots) {
        const map = new Map();
        slots.forEach((slot) => {
            const start = new Date(slot.start);
            const key = slotLookupKey(start, `${start.getHours()}:${String(start.getMinutes()).padStart(2, '0')}`);
            map.set(key, slot);
        });
        return map;
    }

    function getCellDateTime(day, timeLabel) {
        const [hours, minutes] = timeLabel.split(':').map(Number);
        const dt = new Date(day);
        dt.setHours(hours, minutes, 0, 0);
        return dt;
    }

    function isWorkDay(day) {
        const dow = day.getDay();
        return dow >= 1 && dow <= 5;
    }

    function isPastSlot(day, timeLabel) {
        return getCellDateTime(day, timeLabel) <= new Date();
    }

    function isBookableWindow(day, timeLabel) {
        return isWorkDay(day) && CALENDAR_TIME_ROWS.includes(timeLabel);
    }

    function formatTimeDisplay(timeLabel) {
        const [hours, minutes] = timeLabel.split(':').map(Number);
        const dt = new Date();
        dt.setHours(hours, minutes, 0, 0);
        return dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    }

    function isCompactCalendar() {
        return window.matchMedia('(max-width: 900px)').matches;
    }

    function getCalendarDays() {
        const weekDays = Array.from({ length: 7 }, (_, i) => addDays(state.weekStart, i));
        return isCompactCalendar() ? weekDays.filter(isWorkDay) : weekDays;
    }

    function renderCalendarGrid(slots) {
        const weekDays = getCalendarDays();
        const slotMap = indexSlotsByCell(slots);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const calendar = document.createElement('div');
        calendar.className = 'job-hunt-calendar' + (isCompactCalendar() ? ' job-hunt-calendar--weekdays' : '');
        calendar.setAttribute('role', 'grid');
        calendar.setAttribute('aria-label', 'Consultation availability calendar');

        const header = document.createElement('div');
        header.className = 'job-hunt-calendar-header';
        header.setAttribute('role', 'row');

        const corner = document.createElement('div');
        corner.className = 'job-hunt-cal-corner';
        corner.setAttribute('role', 'columnheader');
        corner.textContent = 'Time';
        header.appendChild(corner);

        weekDays.forEach((day, index) => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'job-hunt-cal-day-header';
            dayHeader.setAttribute('role', 'columnheader');
            if (isSameCalendarDay(day, today)) {
                dayHeader.classList.add('job-hunt-cal-day-header--today');
            }
            if (!isWorkDay(day)) {
                dayHeader.classList.add('job-hunt-cal-day-header--weekend');
            }

            const weekday = document.createElement('span');
            weekday.className = 'job-hunt-cal-weekday';
            weekday.textContent = day.toLocaleDateString(undefined, { weekday: 'short' });

            const dateNum = document.createElement('span');
            dateNum.className = 'job-hunt-cal-date';
            dateNum.textContent = String(day.getDate());

            dayHeader.appendChild(weekday);
            dayHeader.appendChild(dateNum);
            header.appendChild(dayHeader);
        });

        calendar.appendChild(header);

        const body = document.createElement('div');
        body.className = 'job-hunt-calendar-body';

        CALENDAR_TIME_ROWS.forEach((timeLabel) => {
            const row = document.createElement('div');
            row.className = 'job-hunt-cal-row';
            row.setAttribute('role', 'row');

            const timeCell = document.createElement('div');
            timeCell.className = 'job-hunt-cal-time';
            timeCell.setAttribute('role', 'rowheader');
            timeCell.textContent = formatTimeDisplay(timeLabel);
            row.appendChild(timeCell);

            weekDays.forEach((day) => {
                const cell = document.createElement('div');
                cell.className = 'job-hunt-cal-cell';
                cell.setAttribute('role', 'gridcell');
                if (!isWorkDay(day)) {
                    cell.classList.add('job-hunt-cal-cell--weekend');
                }

                const slot = slotMap.get(slotLookupKey(day, timeLabel));
                if (slot) {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'job-hunt-slot-btn';
                    btn.innerHTML = `<span class="job-hunt-slot-time">${formatTimeDisplay(timeLabel)}</span><span class="job-hunt-slot-label">Book</span>`;
                    btn.setAttribute('aria-label', `Book ${formatSlotLabel(slot.start, slot.end)}`);
                    btn.addEventListener('click', () => selectSlot(slot));
                    cell.appendChild(btn);
                    cell.classList.add('job-hunt-cal-cell--available');
                } else {
                    cell.classList.add('job-hunt-cal-cell--unavailable');
                    if (!isBookableWindow(day, timeLabel)) {
                        cell.classList.add('job-hunt-cal-cell--closed');
                        cell.setAttribute('aria-label', 'Not available');
                    } else if (isPastSlot(day, timeLabel)) {
                        cell.classList.add('job-hunt-cal-cell--past');
                        cell.setAttribute('aria-label', 'Past');
                    } else {
                        cell.classList.add('job-hunt-cal-cell--booked');
                        cell.setAttribute('aria-label', 'Fully booked');
                    }
                }

                row.appendChild(cell);
            });

            body.appendChild(row);
        });

        calendar.appendChild(body);
        return calendar;
    }

    function cacheElements() {
        els.app = document.getElementById('jobHuntBookingApp');
        if (!els.app) return false;

        els.stepCalendar = document.getElementById('jobHuntStepCalendar');
        els.stepForm = document.getElementById('jobHuntStepForm');
        els.stepPayment = document.getElementById('jobHuntStepPayment');
        els.stepConfirmed = document.getElementById('jobHuntStepConfirmed');
        els.weekLabel = document.getElementById('jobHuntWeekLabel');
        els.slotsLoading = document.getElementById('jobHuntSlotsLoading');
        els.slotsError = document.getElementById('jobHuntSlotsError');
        els.slotsGrid = document.getElementById('jobHuntSlotsGrid');
        els.prevWeek = document.getElementById('jobHuntPrevWeek');
        els.nextWeek = document.getElementById('jobHuntNextWeek');
        els.selectedSlot = document.getElementById('jobHuntSelectedSlot');
        els.form = document.getElementById('jobHuntBookingForm');
        els.formError = document.getElementById('jobHuntFormError');
        els.backToSlots = document.getElementById('jobHuntBackToSlots');
        els.payAmount = document.getElementById('jobHuntPayAmount');
        els.payLink = document.getElementById('jobHuntPayLink');
        els.paymentWaiting = document.getElementById('jobHuntPaymentWaiting');
        els.paymentError = document.getElementById('jobHuntPaymentError');
        els.confirmedMessage = document.getElementById('jobHuntConfirmedMessage');
        return true;
    }

    function showStep(step) {
        [els.stepCalendar, els.stepForm, els.stepPayment, els.stepConfirmed].forEach((el) => {
            if (el) el.hidden = true;
        });
        if (step) step.hidden = false;
    }

    async function fetchAvailability() {
        els.slotsLoading.hidden = false;
        els.slotsError.hidden = true;
        els.slotsGrid.hidden = true;
        els.slotsGrid.innerHTML = '';
        els.weekLabel.textContent = formatWeekLabel(state.weekStart);
        if (els.prevWeek) els.prevWeek.disabled = true;
        if (els.nextWeek) els.nextWeek.disabled = true;

        const from = toIsoUtc(state.weekStart);
        const to = toIsoUtc(addDays(state.weekStart, 7));

        try {
            const res = await fetch(
                `${API_BASE}/consultations/availability?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
            );
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Could not load availability');
            }

            if (typeof data.priceZar === 'number') {
                state.priceZar = data.priceZar;
            }

            els.slotsLoading.hidden = true;
            const slots = data.slots || [];
            state.availabilitySlots = slots;

            els.slotsGrid.appendChild(renderCalendarGrid(slots));
            els.slotsGrid.hidden = false;

            if (!slots.length) {
                els.slotsError.textContent = 'No open slots this week. Try another week.';
                els.slotsError.hidden = false;
            }
        } catch (err) {
            els.slotsLoading.hidden = true;
            els.slotsError.textContent = err.message || 'Failed to load times.';
            els.slotsError.hidden = false;
        } finally {
            if (els.prevWeek) els.prevWeek.disabled = false;
            if (els.nextWeek) els.nextWeek.disabled = false;
        }
    }

    function selectSlot(slot) {
        state.selectedSlot = slot;
        els.selectedSlot.textContent = formatSlotLabel(slot.start, slot.end);
        showStep(els.stepForm);
    }

    function getReturnParams() {
        const pageParams = new URLSearchParams(window.location.search);
        if (pageParams.get('payment') && pageParams.get('bookingId')) {
            return pageParams;
        }
        return getHashParams();
    }

    async function syncBookingPayment(bookingId) {
        try {
            const res = await fetch(
                `${API_BASE}/consultations/bookings/${encodeURIComponent(bookingId)}/sync-payment`,
                { method: 'POST' }
            );
            const data = await res.json();
            return res.ok && data.success ? data : null;
        } catch {
            return null;
        }
    }

    function showProcessingPaymentMessage(yocoStatus) {
        const status = (yocoStatus || '').toLowerCase();
        if (status === 'processing' || status === 'started') {
            els.paymentWaiting.textContent =
                'Your bank is still approving the payment. Complete any OTP or 3-D Secure step from your bank, then wait here. Do not use test cards with live payments.';
            els.paymentError.hidden = true;
            return true;
        }
        if (status === 'created') {
            els.paymentWaiting.textContent =
                'Waiting for payment in the secure window. Complete your card payment there, then return here.';
            return true;
        }
        return false;
    }

    async function checkBookingStatus(bookingId, showWaiting) {
        if (showWaiting) {
            els.paymentWaiting.hidden = false;
            els.paymentError.hidden = true;
        }

        try {
            const syncData = await syncBookingPayment(bookingId);
            const res = await fetch(`${API_BASE}/consultations/bookings/${encodeURIComponent(bookingId)}`);
            const data = await res.json();
            if (!res.ok || !data.success) return false;

            const booking = data.booking;
            if (booking.status === 'confirmed') {
                stopPolling();
                sessionStorage.removeItem(PENDING_BOOKING_KEY);
                sessionStorage.removeItem(CHECKOUT_URL_KEY);
                els.paymentWaiting.hidden = true;
                els.confirmedMessage.textContent = formatSlotLabel(booking.slotStart, booking.slotEnd);
                showStep(els.stepConfirmed);
                return true;
            }

            if (booking.status === 'expired') {
                stopPolling();
                sessionStorage.removeItem(PENDING_BOOKING_KEY);
                els.paymentWaiting.hidden = true;
                els.paymentError.textContent = 'Payment window expired. Please book again.';
                els.paymentError.hidden = false;
                showStep(els.stepCalendar);
                fetchAvailability();
                return true;
            }

            if (showWaiting) {
                if (!showProcessingPaymentMessage(syncData && syncData.yocoStatus)) {
                    els.paymentWaiting.textContent =
                        'Confirming your payment… This can take a minute while your bank approves the charge.';
                }
            }
        } catch {
            // keep polling after return from Yoco
        }

        return false;
    }

    function startPolling() {
        stopPolling();
        state.pollTimer = setInterval(async () => {
            if (!state.bookingId) return;
            await checkBookingStatus(state.bookingId, true);
        }, 4000);
    }

    function stopPolling() {
        if (state.pollTimer) {
            clearInterval(state.pollTimer);
            state.pollTimer = null;
        }
    }

    function openYocoCheckout(redirectUrl, bookingId) {
        state.bookingId = bookingId;
        sessionStorage.setItem(PENDING_BOOKING_KEY, bookingId);
        sessionStorage.setItem(CHECKOUT_URL_KEY, redirectUrl);
        // Full-page redirect is required for live 3-D Secure / bank OTP flows (popups hang on desktop).
        window.location.replace(redirectUrl);
    }

    function resumePendingPayment() {
        const pendingBookingId = sessionStorage.getItem(PENDING_BOOKING_KEY);
        if (!pendingBookingId) return;

        state.bookingId = pendingBookingId;
        els.payAmount.textContent = `R${state.priceZar}`;
        const checkoutUrl = sessionStorage.getItem(CHECKOUT_URL_KEY);
        if (els.payLink && checkoutUrl) {
            els.payLink.href = checkoutUrl;
        }
        showStep(els.stepPayment);
        els.paymentWaiting.hidden = false;
        els.paymentWaiting.textContent =
            'Confirming your payment… This can take a minute while your bank approves the charge.';
        startPolling();
    }

    async function handlePaymentReturn() {
        const params = getReturnParams();
        const payment = params.get('payment');
        const bookingId = params.get('bookingId');
        if (!payment || !bookingId) {
            resumePendingPayment();
            return;
        }

        state.bookingId = bookingId;
        sessionStorage.setItem(PENDING_BOOKING_KEY, bookingId);

        if (payment === 'cancelled' || payment === 'failed') {
            sessionStorage.removeItem(PENDING_BOOKING_KEY);
            const checkoutUrl = sessionStorage.getItem(CHECKOUT_URL_KEY);
            if (els.payLink && checkoutUrl) {
                els.payLink.href = checkoutUrl;
            }
            els.paymentError.textContent =
                payment === 'failed'
                    ? 'Payment failed. Your slot is still held briefly — you can try again.'
                    : 'Payment was cancelled. Your slot is still held briefly — you can try again.';
            els.paymentError.hidden = false;
            showStep(els.stepPayment);
            return;
        }

        if (payment === 'success') {
            showStep(els.stepPayment);
            const confirmed = await checkBookingStatus(bookingId, true);
            if (!confirmed) {
                startPolling();
            }
        }
    }

    async function submitBooking(event) {
        event.preventDefault();
        els.formError.hidden = true;

        const name = document.getElementById('jobHuntName').value.trim();
        const email = document.getElementById('jobHuntEmail').value.trim();
        const phone = document.getElementById('jobHuntPhone').value.trim();
        const notes = document.getElementById('jobHuntNotes').value.trim();

        if (!state.selectedSlot) {
            els.formError.textContent = 'Please select a time slot.';
            els.formError.hidden = false;
            return;
        }

        const submitBtn = document.getElementById('jobHuntSubmitBooking');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Continuing to secure payment…';
        let redirectingToCheckout = false;

        try {
            const res = await fetch(`${API_BASE}/consultations/book`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slotStart: state.selectedSlot.start,
                    slotEnd: state.selectedSlot.end,
                    name,
                    email,
                    phone: phone || undefined,
                    notes: notes || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Booking failed');
            }

            state.bookingId = data.bookingId;

            if (!data.checkoutRedirectUrl) {
                throw new Error(
                    'Payment could not be started. The server may be missing YOCO_SECRET_KEY — please contact support.'
                );
            }

            redirectingToCheckout = true;
            openYocoCheckout(data.checkoutRedirectUrl, data.bookingId);
        } catch (err) {
            els.formError.textContent = err.message || 'Could not create booking.';
            els.formError.hidden = false;
        } finally {
            if (!redirectingToCheckout) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Book kickoff for R800';
            }
        }
    }

    function rerenderCalendarIfNeeded() {
        if (!els.stepCalendar || els.stepCalendar.hidden || !state.availabilitySlots) return;
        els.slotsGrid.innerHTML = '';
        els.slotsGrid.appendChild(renderCalendarGrid(state.availabilitySlots));
    }

    function bindEvents() {
        els.prevWeek.addEventListener('click', () => {
            state.weekStart = addDays(state.weekStart, -7);
            fetchAvailability();
        });
        els.nextWeek.addEventListener('click', () => {
            state.weekStart = addDays(state.weekStart, 7);
            fetchAvailability();
        });
        els.backToSlots.addEventListener('click', () => {
            showStep(els.stepCalendar);
        });
        els.form.addEventListener('submit', submitBooking);
        if (els.payLink) {
            els.payLink.addEventListener('click', (event) => {
                const checkoutUrl = sessionStorage.getItem(CHECKOUT_URL_KEY);
                if (!checkoutUrl || checkoutUrl === '#') return;
                event.preventDefault();
                window.location.replace(checkoutUrl);
            });
        }

        let compactCalendar = isCompactCalendar();
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                const nextCompact = isCompactCalendar();
                if (nextCompact !== compactCalendar) {
                    compactCalendar = nextCompact;
                    rerenderCalendarIfNeeded();
                }
            }, 150);
        });
    }

    function initJobHuntBooking() {
        if (!cacheElements()) return;
        bindEvents();
        handlePaymentReturn();
        if (!getReturnParams().get('payment')) {
            fetchAvailability();
        }
    }

    function onPaymentMessage(event) {
        if (!event.data || event.data.type !== 'jobHuntPayment') return;
        const bookingId = event.data.bookingId;
        if (!bookingId) return;
        state.bookingId = bookingId;
        if (event.data.payment === 'success') {
            checkBookingStatus(bookingId, true).then((confirmed) => {
                if (!confirmed) startPolling();
            });
            return;
        }
        if (event.data.payment === 'cancelled' || event.data.payment === 'failed') {
            sessionStorage.removeItem(PENDING_BOOKING_KEY);
            els.paymentError.textContent =
                event.data.payment === 'failed'
                    ? 'Payment failed. Your slot is still held briefly — you can try again.'
                    : 'Payment was cancelled. Your slot is still held briefly — you can try again.';
            els.paymentError.hidden = false;
            showStep(els.stepPayment);
        }
    }

    function onPageShown() {
        const jobHuntPage = document.getElementById('job-hunt');
        if (jobHuntPage && jobHuntPage.classList.contains('active')) {
            if (!els.app && cacheElements()) {
                bindEvents();
            }
            handlePaymentReturn();
            if (els.app && els.slotsGrid && !els.slotsGrid.innerHTML && !getReturnParams().get('payment')) {
                fetchAvailability();
            }
        } else {
            stopPolling();
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        initJobHuntBooking();
        window.addEventListener('hashchange', onPageShown);
        window.addEventListener('message', onPaymentMessage);

        const originalShowPage = window.showPage;
        if (typeof originalShowPage === 'function') {
            window.showPage = function (pageId, updateHash) {
                originalShowPage(pageId, updateHash);
                setTimeout(onPageShown, 50);
            };
        }
    });
})();
