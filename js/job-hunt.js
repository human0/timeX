/**
 * AI Job Hunt consultation booking UI
 */
(function () {
    const API_BASE = 'https://tbserver-1059280513734.africa-south1.run.app';
    const PENDING_BOOKING_KEY = 'jobHuntPendingBooking';
    const CHECKOUT_URL_KEY = 'jobHuntCheckoutUrl';
    const PENDING_SLOT_KEY = 'jobHuntPendingSlot';
    const BOOKING_EMAIL_KEY = 'jobHuntBookingEmail';
    const AWAITING_CONFIRMATION_KEY = 'jobHuntAwaitingConfirmation';

    const state = {
        weekStart: startOfWeek(new Date()),
        selectedSlot: null,
        bookingId: null,
        pollTimer: null,
        priceZar: 500,
        availabilitySlots: null,
        checkoutModalOpen: false,
        pendingSlot: null,
        awaitingPaymentConfirmation: false,
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

    const CALENDAR_TIME_ROWS = [
        '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
        '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
    ];

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
        return dow >= 1 && dow <= 6;
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

    function getPendingSlotKey(slot) {
        if (!slot || !slot.start) return null;
        const start = new Date(slot.start);
        return slotLookupKey(start, `${start.getHours()}:${String(start.getMinutes()).padStart(2, '0')}`);
    }

    function isPendingSlotCell(day, timeLabel) {
        if (!state.pendingSlot) return false;
        const pendingKey = getPendingSlotKey(state.pendingSlot);
        return pendingKey && pendingKey === slotLookupKey(day, timeLabel);
    }

    function storePendingSlot(slot) {
        if (!slot) return;
        state.pendingSlot = { start: slot.start, end: slot.end };
        try {
            sessionStorage.setItem(PENDING_SLOT_KEY, JSON.stringify(state.pendingSlot));
        } catch (_) {
            /* ignore */
        }
    }

    function restorePendingSlot() {
        if (state.pendingSlot) return state.pendingSlot;
        try {
            const raw = sessionStorage.getItem(PENDING_SLOT_KEY);
            if (raw) {
                state.pendingSlot = JSON.parse(raw);
            }
        } catch (_) {
            /* ignore */
        }
        return state.pendingSlot;
    }

    function clearPendingSlot() {
        state.pendingSlot = null;
        try {
            sessionStorage.removeItem(PENDING_SLOT_KEY);
        } catch (_) {
            /* ignore */
        }
    }

    async function ensurePendingSlotFromBooking(bookingId) {
        restorePendingSlot();
        if (state.pendingSlot || !bookingId) return state.pendingSlot;
        try {
            const res = await fetch(`${API_BASE}/consultations/bookings/${encodeURIComponent(bookingId)}`);
            const data = await res.json();
            if (res.ok && data.success && data.booking) {
                storePendingSlot({ start: data.booking.slotStart, end: data.booking.slotEnd });
            }
        } catch (_) {
            /* ignore */
        }
        return state.pendingSlot;
    }

    function setAwaitingConfirmation(awaiting) {
        state.awaitingPaymentConfirmation = !!awaiting;
        try {
            if (awaiting) {
                sessionStorage.setItem(AWAITING_CONFIRMATION_KEY, '1');
            } else {
                sessionStorage.removeItem(AWAITING_CONFIRMATION_KEY);
            }
        } catch (_) {
            /* ignore */
        }
    }

    function restoreAwaitingConfirmation() {
        if (state.awaitingPaymentConfirmation) return true;
        try {
            state.awaitingPaymentConfirmation = sessionStorage.getItem(AWAITING_CONFIRMATION_KEY) === '1';
        } catch (_) {
            /* ignore */
        }
        return state.awaitingPaymentConfirmation;
    }

    function clearAwaitingConfirmation() {
        setAwaitingConfirmation(false);
    }

    function getPendingSlotMeta() {
        return {
            cellClass: 'job-hunt-cal-cell--pending-active',
            ariaLabel: 'Booking in progress',
        };
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

                if (isPendingSlotCell(day, timeLabel)) {
                    const pendingMeta = getPendingSlotMeta();
                    cell.classList.add('job-hunt-cal-cell--pending', pendingMeta.cellClass);
                    cell.setAttribute('aria-label', pendingMeta.ariaLabel);
                    cell.innerHTML =
                        '<div class="job-hunt-slot-pending">' +
                        '<span class="job-hunt-slot-pending-spinner" aria-hidden="true"></span>' +
                        '</div>';
                } else {
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
                    if (!isBookableWindow(day, timeLabel)) {
                        cell.classList.add('job-hunt-cal-cell--unavailable', 'job-hunt-cal-cell--striped');
                        cell.setAttribute('aria-label', 'Not available');
                    } else if (isPastSlot(day, timeLabel)) {
                        cell.classList.add(
                            'job-hunt-cal-cell--unavailable',
                            'job-hunt-cal-cell--striped',
                            'job-hunt-cal-cell--past'
                        );
                        cell.setAttribute('aria-label', 'Past');
                    } else {
                        cell.classList.add('job-hunt-cal-cell--booked');
                        cell.setAttribute('aria-label', 'Fully booked');
                        cell.innerHTML =
                            '<div class="job-hunt-slot-booked">' +
                            '<span class="job-hunt-slot-booked-label">Booked</span>' +
                            '</div>';
                    }
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
        els.confirmedMessage = document.getElementById('jobHuntConfirmedMessage');
        els.checkoutModal = document.getElementById('jobHuntCheckoutModal');
        els.checkoutFrame = document.getElementById('jobHuntCheckoutFrame');
        els.pendingActions = document.getElementById('jobHuntPendingActions');
        els.cancelPayment = document.getElementById('jobHuntCancelPayment');
        els.cancelCheckout = document.getElementById('jobHuntCancelCheckout');
        return true;
    }

    function showStep(step) {
        [els.stepCalendar, els.stepForm, els.stepConfirmed].forEach((el) => {
            if (el) el.hidden = true;
        });
        if (step) step.hidden = false;
    }

    function rerenderCalendar() {
        if (!els.slotsGrid) return;
        els.slotsLoading.hidden = true;
        els.slotsGrid.innerHTML = '';
        if (state.availabilitySlots) {
            els.slotsGrid.appendChild(renderCalendarGrid(state.availabilitySlots));
            els.slotsGrid.hidden = false;
        }
    }

    function updateWeekNavState() {
        const lockNav = !!state.pendingSlot;
        if (els.prevWeek) els.prevWeek.disabled = lockNav;
        if (els.nextWeek) els.nextWeek.disabled = lockNav;
    }

    function hasPendingBooking() {
        return !!(state.bookingId || sessionStorage.getItem(PENDING_BOOKING_KEY) || state.pendingSlot);
    }

    function updatePendingActionsVisibility() {
        const visible = hasPendingBooking() && !state.awaitingPaymentConfirmation;
        if (els.pendingActions) els.pendingActions.hidden = !visible;
    }

    function clearCheckoutSession() {
        try {
            sessionStorage.removeItem(PENDING_BOOKING_KEY);
            sessionStorage.removeItem(CHECKOUT_URL_KEY);
            sessionStorage.removeItem(BOOKING_EMAIL_KEY);
        } catch (_) {
            /* ignore */
        }
    }

    function clearPendingBookingState() {
        state.bookingId = null;
        state.selectedSlot = null;
        clearPendingSlot();
        clearAwaitingConfirmation();
        clearCheckoutSession();
        resetSubmitButton();
        updatePendingActionsVisibility();
        if (els.slotsError) els.slotsError.hidden = true;
    }

    async function requestBookingCancel(bookingId, email) {
        const res = await fetch(
            `${API_BASE}/consultations/bookings/${encodeURIComponent(bookingId)}/cancel`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email || undefined }),
            }
        );
        const data = await res.json();
        if (!res.ok || !data.success) {
            throw new Error(data.error || 'Could not cancel booking');
        }
        return data;
    }

    async function cancelPendingBookingSilently() {
        const bookingId = state.bookingId || sessionStorage.getItem(PENDING_BOOKING_KEY);
        stopPolling();
        closeCheckoutModal();

        if (bookingId) {
            let email = '';
            try {
                email = sessionStorage.getItem(BOOKING_EMAIL_KEY) || '';
            } catch (_) {
                /* ignore */
            }
            try {
                await requestBookingCancel(bookingId, email);
            } catch (_) {
                /* release local state even if cancel request fails */
            }
        }

        clearPendingBookingState();
        showStep(els.stepCalendar);
        await fetchAvailability();
    }

    async function cancelPendingBooking() {
        const bookingId = state.bookingId || sessionStorage.getItem(PENDING_BOOKING_KEY);
        if (!bookingId) return;

        if (!window.confirm('Cancel this booking and release your time slot?')) {
            return;
        }

        let email = '';
        try {
            email = sessionStorage.getItem(BOOKING_EMAIL_KEY) || '';
        } catch (_) {
            /* ignore */
        }

        const buttons = [els.cancelPayment, els.cancelCheckout].filter(Boolean);
        buttons.forEach((btn) => {
            btn.disabled = true;
        });

        try {
            await requestBookingCancel(bookingId, email);

            stopPolling();
            closeCheckoutModal();
            clearPendingBookingState();
            showStep(els.stepCalendar);
            await fetchAvailability();
        } catch (err) {
            if (els.slotsError) {
                els.slotsError.textContent = err.message || 'Could not cancel booking.';
                els.slotsError.hidden = false;
            }
        } finally {
            buttons.forEach((btn) => {
                btn.disabled = false;
            });
        }
    }

    function showCalendarPending(slot) {
        if (slot) {
            storePendingSlot(slot);
        } else {
            restorePendingSlot();
        }
        if (state.pendingSlot) {
            state.weekStart = startOfWeek(new Date(state.pendingSlot.start));
            if (els.weekLabel) {
                els.weekLabel.textContent = formatWeekLabel(state.weekStart);
            }
        }
        showStep(els.stepCalendar);
        if (state.availabilitySlots) {
            rerenderCalendar();
        } else {
            fetchAvailability();
        }
        updateWeekNavState();
        updatePendingActionsVisibility();
    }

    function clearCalendarPending() {
        clearPendingSlot();
        clearAwaitingConfirmation();
        rerenderCalendar();
        updateWeekNavState();
        updatePendingActionsVisibility();
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
            updatePriceLabels();

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
            if (els.prevWeek) els.prevWeek.disabled = !!state.pendingSlot;
            if (els.nextWeek) els.nextWeek.disabled = !!state.pendingSlot;
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

    async function checkBookingStatus(bookingId, showWaiting) {
        if (showWaiting) {
            await ensurePendingSlotFromBooking(bookingId);
            if (els.stepCalendar && els.stepCalendar.hidden) {
                showCalendarPending();
            } else {
                rerenderCalendar();
            }
        }

        try {
            const syncData = await syncBookingPayment(bookingId);
            const res = await fetch(`${API_BASE}/consultations/bookings/${encodeURIComponent(bookingId)}`);
            const data = await res.json();
            if (!res.ok || !data.success) return false;

            const booking = data.booking;
            if (booking.status === 'confirmed') {
                stopPolling();
                closeCheckoutModal();
                clearPendingBookingState();
                els.confirmedMessage.textContent = formatSlotLabel(booking.slotStart, booking.slotEnd);
                resetSubmitButton();
                showStep(els.stepConfirmed);
                return true;
            }

            if (booking.status === 'expired' || booking.status === 'cancelled') {
                stopPolling();
                closeCheckoutModal();
                clearPendingBookingState();
                if (booking.status === 'expired' && els.slotsError) {
                    els.slotsError.textContent = 'Payment window expired. Please book again.';
                    els.slotsError.hidden = false;
                }
                showStep(els.stepCalendar);
                fetchAvailability();
                return true;
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
            await checkBookingStatus(state.bookingId, false);
        }, 4000);
    }

    function stopPolling() {
        if (state.pollTimer) {
            clearInterval(state.pollTimer);
            state.pollTimer = null;
        }
    }

    function openCheckoutModal(redirectUrl, bookingId) {
        if (!els.checkoutModal || !els.checkoutFrame) {
            window.location.assign(redirectUrl);
            return false;
        }

        state.bookingId = bookingId;
        state.checkoutModalOpen = true;
        els.checkoutModal.hidden = false;
        document.body.classList.add('job-hunt-checkout-open');
        els.checkoutFrame.src = redirectUrl;
        return true;
    }

    function closeCheckoutModal(clearFrame) {
        if (!els.checkoutModal) return;
        state.checkoutModalOpen = false;
        els.checkoutModal.hidden = true;
        document.body.classList.remove('job-hunt-checkout-open');
        if (clearFrame !== false && els.checkoutFrame) {
            els.checkoutFrame.src = 'about:blank';
        }
    }

    function launchCheckoutModal(redirectUrl, bookingId) {
        storeCheckoutSession(bookingId, redirectUrl);
        return openCheckoutModal(redirectUrl, bookingId);
    }

    async function handleCheckoutModalClosed() {
        if (!state.checkoutModalOpen) return;
        if (state.awaitingPaymentConfirmation) {
            closeCheckoutModal(false);
            return;
        }
        await cancelPendingBookingSilently();
    }

    function storeCheckoutSession(bookingId, redirectUrl) {
        try {
            sessionStorage.setItem(PENDING_BOOKING_KEY, bookingId);
            sessionStorage.setItem(CHECKOUT_URL_KEY, redirectUrl);
        } catch (_) {
            /* Safari private browsing can block storage */
        }
    }

    function storeBookingEmail(email) {
        try {
            sessionStorage.setItem(BOOKING_EMAIL_KEY, email);
        } catch (_) {
            /* ignore */
        }
    }

    function formatBookLabel() {
        return `Book kickoff for R${state.priceZar}`;
    }

    function updatePriceLabels() {
        document.querySelectorAll('[data-job-hunt-price]').forEach((el) => {
            el.textContent = `R${state.priceZar}`;
        });
        const submitBtn = document.getElementById('jobHuntSubmitBooking');
        if (submitBtn && !submitBtn.disabled) {
            submitBtn.textContent = formatBookLabel();
        }
    }

    function resetSubmitButton() {
        const submitBtn = document.getElementById('jobHuntSubmitBooking');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = formatBookLabel();
        }
    }

    function beginYocoCheckout(redirectUrl, bookingId) {
        state.bookingId = bookingId;
        storeCheckoutSession(bookingId, redirectUrl);
        setAwaitingConfirmation(false);
        showCalendarPending(state.selectedSlot);
        launchCheckoutModal(redirectUrl, bookingId);
        return true;
    }

    async function resumePendingPayment() {
        const pendingBookingId = sessionStorage.getItem(PENDING_BOOKING_KEY);
        const checkoutUrl = sessionStorage.getItem(CHECKOUT_URL_KEY);
        if (!pendingBookingId) return;

        state.bookingId = pendingBookingId;
        restorePendingSlot();
        restoreAwaitingConfirmation();
        await ensurePendingSlotFromBooking(pendingBookingId);

        try {
            const res = await fetch(
                `${API_BASE}/consultations/bookings/${encodeURIComponent(pendingBookingId)}`
            );
            const data = await res.json();
            if (!res.ok || !data.success) {
                await cancelPendingBookingSilently();
                return;
            }

            const booking = data.booking;
            if (booking.status === 'confirmed') {
                clearPendingBookingState();
                els.confirmedMessage.textContent = formatSlotLabel(booking.slotStart, booking.slotEnd);
                showStep(els.stepConfirmed);
                return;
            }

            if (booking.status === 'expired' || booking.status === 'cancelled') {
                await cancelPendingBookingSilently();
                return;
            }

            if (state.awaitingPaymentConfirmation) {
                showCalendarPending();
                startPolling();
                return;
            }

            if (checkoutUrl) {
                showCalendarPending();
                launchCheckoutModal(checkoutUrl, pendingBookingId);
                return;
            }

            await cancelPendingBookingSilently();
        } catch {
            await cancelPendingBookingSilently();
        }
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
            await cancelPendingBookingSilently();
            return;
        }

        if (payment === 'success') {
            closeCheckoutModal();
            storePendingSlot(state.selectedSlot);
            await ensurePendingSlotFromBooking(bookingId);
            setAwaitingConfirmation(true);
            showCalendarPending();
            const confirmed = await checkBookingStatus(bookingId, false);
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
            storeBookingEmail(email);

            if (!data.checkoutRedirectUrl) {
                throw new Error(
                    'Payment could not be started. The server may be missing YOCO_SECRET_KEY — please contact support.'
                );
            }

            redirectingToCheckout = beginYocoCheckout(data.checkoutRedirectUrl, data.bookingId);
        } catch (err) {
            els.formError.textContent = err.message || 'Could not create booking.';
            els.formError.hidden = false;
        } finally {
            if (!redirectingToCheckout) {
                submitBtn.disabled = false;
                submitBtn.textContent = formatBookLabel();
            }
        }
    }

    function rerenderCalendarIfNeeded() {
        if (!els.slotsGrid || !state.availabilitySlots) return;
        if (els.stepCalendar && !els.stepCalendar.hidden) {
            rerenderCalendar();
        }
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
        if (els.checkoutModal) {
            els.checkoutModal.querySelectorAll('[data-checkout-close]').forEach((el) => {
                el.addEventListener('click', handleCheckoutModalClosed);
            });
        }
        if (els.cancelPayment) {
            els.cancelPayment.addEventListener('click', cancelPendingBooking);
        }
        if (els.cancelCheckout) {
            els.cancelCheckout.addEventListener('click', cancelPendingBooking);
        }
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && state.checkoutModalOpen) {
                handleCheckoutModalClosed();
            }
        });

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
        if (event.origin !== window.location.origin) return;
        if (!event.data || event.data.type !== 'jobHuntPayment') return;
        const bookingId = event.data.bookingId;
        if (!bookingId) return;
        state.bookingId = bookingId;
        if (event.data.payment === 'success') {
            closeCheckoutModal(false);
            setAwaitingConfirmation(true);
            ensurePendingSlotFromBooking(bookingId).then(() => {
                showCalendarPending();
                checkBookingStatus(bookingId, false).then((confirmed) => {
                    if (!confirmed) startPolling();
                });
            });
            return;
        }
        if (event.data.payment === 'cancelled' || event.data.payment === 'failed') {
            cancelPendingBookingSilently();
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
        window.addEventListener('pageshow', (event) => {
            if (!event.persisted) return;
            const jobHuntPage = document.getElementById('job-hunt');
            if (jobHuntPage && jobHuntPage.classList.contains('active')) {
                if (!els.app && cacheElements()) {
                    bindEvents();
                }
                handlePaymentReturn();
            }
        });

        const originalShowPage = window.showPage;
        if (typeof originalShowPage === 'function') {
            window.showPage = function (pageId, updateHash) {
                originalShowPage(pageId, updateHash);
                setTimeout(onPageShown, 50);
            };
        }
    });
})();
