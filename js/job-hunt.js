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

    const TIMEX_REQUEST_ID = 'WjBrnZjr4gxC0G0ZW4X6';
    const TIMEX_REQUEST_URL = 'https://timexchange.co.za/request/' + TIMEX_REQUEST_ID;
    const TIMEX_IOS_STORE = 'https://apps.apple.com/za/app/time-x/id6748560628';
    const TIMEX_ANDROID_STORE =
        'https://play.google.com/store/apps/details?id=com.timeexchange.timebank';
    const TIMEX_DEEP_LINK = 'timebank://request/' + encodeURIComponent(TIMEX_REQUEST_ID);
    const TIMEX_ANDROID_INTENT =
        'intent://request/' +
        encodeURIComponent(TIMEX_REQUEST_ID) +
        '#Intent;scheme=timebank;package=com.timeexchange.timebank;S.browser_fallback_url=' +
        encodeURIComponent(TIMEX_ANDROID_STORE) +
        ';end';

    const TZ_COOKIE = 'tx_tz';
    const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
    const HOST_TIMEZONE = 'Africa/Johannesburg';
    const COMMON_TIMEZONES = [
        'Africa/Johannesburg',
        'Africa/Lagos',
        'Africa/Nairobi',
        'Europe/London',
        'Europe/Paris',
        'Europe/Berlin',
        'America/New_York',
        'America/Chicago',
        'America/Denver',
        'America/Los_Angeles',
        'America/Sao_Paulo',
        'Asia/Dubai',
        'Asia/Kolkata',
        'Asia/Singapore',
        'Asia/Tokyo',
        'Australia/Sydney',
        'Pacific/Auckland',
    ];

    const state = {
        viewMonth: startOfMonth(new Date()),
        selectedDate: null,
        selectedSlot: null,
        selectedOffer: 'paid',
        highlightedSlotStart: null,
        bookingId: null,
        pollTimer: null,
        priceZar: 0,
        regularPriceZar: 500,
        freeFirstPromo: true,
        durationMinutes: 60,
        freeTrialDurationMinutes: 30,
        paidDurationMinutes: 60,
        availabilitySlots: null,
        checkoutModalOpen: false,
        pendingSlot: null,
        awaitingPaymentConfirmation: false,
        customerTimezone: null,
        hostTimezone: HOST_TIMEZONE,
    };

    const els = {};

    function readCookie(name) {
        const match = document.cookie.match(
            new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)')
        );
        return match ? decodeURIComponent(match[1]) : null;
    }

    function writeCookie(name, value) {
        document.cookie =
            `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
    }

    function detectBrowserTimezone() {
        try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone || HOST_TIMEZONE;
        } catch (_) {
            return HOST_TIMEZONE;
        }
    }

    function initLocalePrefs() {
        const savedTz = readCookie(TZ_COOKIE);
        state.customerTimezone = savedTz || detectBrowserTimezone();
        if (!savedTz) writeCookie(TZ_COOKIE, state.customerTimezone);
    }

    function localeDateOptions(extra) {
        const opts = Object.assign({}, extra || {});
        if (state.customerTimezone) opts.timeZone = state.customerTimezone;
        return opts;
    }

    function timezoneLabel(tz) {
        return (tz || '').replace(/_/g, ' ');
    }

    function startOfMonth(date) {
        return new Date(date.getFullYear(), date.getMonth(), 1);
    }

    function addMonths(date, months) {
        return new Date(date.getFullYear(), date.getMonth() + months, 1);
    }

    function startOfDay(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function toIsoUtc(date) {
        return date.toISOString();
    }

    function offerDurationMinutes() {
        if (state.selectedOffer === 'free_trial') {
            return state.freeTrialDurationMinutes || 30;
        }
        return state.paidDurationMinutes || state.durationMinutes || 60;
    }

    function addMinutesIso(isoStart, minutes) {
        const start = new Date(isoStart);
        return new Date(start.getTime() + minutes * 60 * 1000).toISOString();
    }

    /** Ensure free-trial slots are always 30 minutes (split longer API slots if needed). */
    function normalizeSlotsForOffer(slots) {
        const durationMin = offerDurationMinutes();
        if (state.selectedOffer !== 'free_trial') {
            return (slots || []).map((slot) => ({ start: slot.start, end: slot.end }));
        }

        const normalized = [];
        (slots || []).forEach((slot) => {
            const start = new Date(slot.start);
            const end = new Date(slot.end);
            const lengthMin = Math.round((end - start) / 60000);
            if (lengthMin <= durationMin + 1) {
                normalized.push({
                    start: slot.start,
                    end: addMinutesIso(slot.start, durationMin),
                });
                return;
            }
            let cursor = start.getTime();
            const hardEnd = end.getTime();
            while (cursor + durationMin * 60000 <= hardEnd + 1000) {
                const chunkStart = new Date(cursor).toISOString();
                normalized.push({
                    start: chunkStart,
                    end: addMinutesIso(chunkStart, durationMin),
                });
                cursor += durationMin * 60000;
            }
        });
        return normalized;
    }

    function bookingSlotPayload(slot) {
        const durationMin = offerDurationMinutes();
        if (state.selectedOffer === 'free_trial') {
            return {
                slotStart: slot.start,
                slotEnd: addMinutesIso(slot.start, durationMin),
            };
        }
        return {
            slotStart: slot.start,
            slotEnd: slot.end,
        };
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
        const datePart = start.toLocaleDateString(
            undefined,
            localeDateOptions({
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            })
        );
        const timePart = `${start.toLocaleTimeString(
            undefined,
            localeDateOptions({ hour: '2-digit', minute: '2-digit' })
        )} – ${end.toLocaleTimeString(
            undefined,
            localeDateOptions({ hour: '2-digit', minute: '2-digit' })
        )}`;
        return `${datePart}, ${timePart}`;
    }

    function formatMonthLabel(monthStart) {
        return monthStart.toLocaleDateString(
            undefined,
            localeDateOptions({ month: 'long', year: 'numeric' })
        );
    }

    function formatSelectedDayLabel(day) {
        return day.toLocaleDateString(
            undefined,
            localeDateOptions({
                weekday: 'short',
                month: 'short',
                day: 'numeric',
            })
        );
    }

    function isSameCalendarDay(a, b) {
        return (
            a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate()
        );
    }

    function dayKey(date) {
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    }

    function formatTimeFromDate(date) {
        return date
            .toLocaleTimeString(
                undefined,
                localeDateOptions({ hour: 'numeric', minute: '2-digit', hour12: true })
            )
            .replace(/\s/g, '')
            .toLowerCase();
    }

    function getAvailableDayKeys(slots) {
        const keys = new Set();
        (slots || []).forEach((slot) => {
            keys.add(dayKey(new Date(slot.start)));
        });
        return keys;
    }

    function getSlotsForDay(slots, day) {
        return (slots || [])
            .filter((slot) => isSameCalendarDay(new Date(slot.start), day))
            .sort((a, b) => new Date(a.start) - new Date(b.start));
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

    function renderMonthGrid(slots) {
        const availableDays = getAvailableDayKeys(slots);
        const today = startOfDay(new Date());
        const monthStart = state.viewMonth;
        const firstDow = monthStart.getDay(); // 0 = Sunday
        const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();

        const grid = document.createElement('div');
        grid.className = 'job-hunt-month-grid';
        grid.setAttribute('role', 'grid');
        grid.setAttribute('aria-label', 'Select a date');

        const weekdayRow = document.createElement('div');
        weekdayRow.className = 'job-hunt-month-weekdays';
        weekdayRow.setAttribute('role', 'row');
        ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach((label) => {
            const cell = document.createElement('div');
            cell.className = 'job-hunt-month-weekday';
            cell.setAttribute('role', 'columnheader');
            cell.textContent = label;
            weekdayRow.appendChild(cell);
        });
        grid.appendChild(weekdayRow);

        const days = document.createElement('div');
        days.className = 'job-hunt-month-days';
        days.setAttribute('role', 'rowgroup');

        for (let i = 0; i < firstDow; i += 1) {
            const empty = document.createElement('div');
            empty.className = 'job-hunt-month-day job-hunt-month-day--empty';
            empty.setAttribute('aria-hidden', 'true');
            days.appendChild(empty);
        }

        for (let dayNum = 1; dayNum <= daysInMonth; dayNum += 1) {
            const day = new Date(monthStart.getFullYear(), monthStart.getMonth(), dayNum);
            const key = dayKey(day);
            const isPast = day < today;
            const hasSlots = availableDays.has(key);
            const isSelected = state.selectedDate && isSameCalendarDay(day, state.selectedDate);
            const isToday = isSameCalendarDay(day, today);
            const isPendingDay =
                state.pendingSlot && isSameCalendarDay(day, new Date(state.pendingSlot.start));

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'job-hunt-month-day';
            btn.textContent = String(dayNum);
            btn.setAttribute('role', 'gridcell');

            if (isToday) btn.classList.add('job-hunt-month-day--today');
            if (isSelected) {
                btn.classList.add('job-hunt-month-day--selected');
                btn.setAttribute('aria-pressed', 'true');
            } else {
                btn.setAttribute('aria-pressed', 'false');
            }
            if (isPendingDay) {
                btn.classList.add('job-hunt-month-day--available', 'job-hunt-month-day--pending');
                btn.disabled = false;
                btn.setAttribute('aria-label', `Booking in progress ${formatSelectedDayLabel(day)}`);
                btn.addEventListener('click', () => selectDate(day));
            } else if (isPast || !hasSlots || state.pendingSlot) {
                btn.classList.add('job-hunt-month-day--disabled');
                btn.disabled = true;
            } else {
                btn.classList.add('job-hunt-month-day--available');
                btn.setAttribute('aria-label', `Available ${formatSelectedDayLabel(day)}`);
                btn.addEventListener('click', () => selectDate(day));
            }

            days.appendChild(btn);
        }

        grid.appendChild(days);
        return grid;
    }

    function isCompactCalendar() {
        return window.matchMedia('(max-width: 720px)').matches;
    }

    function renderTimesPanel(slots) {
        const panel = document.createElement('div');
        panel.className = 'job-hunt-times-panel';

        if (!state.selectedDate) {
            panel.innerHTML = '<p class="job-hunt-times-empty">Select a day</p>';
            return panel;
        }

        if (isCompactCalendar()) {
            const backBtn = document.createElement('button');
            backBtn.type = 'button';
            backBtn.className = 'job-hunt-back-link job-hunt-back-link--times';
            backBtn.innerHTML = '<span aria-hidden="true">&lsaquo;</span> Back';
            backBtn.addEventListener('click', () => {
                state.selectedDate = null;
                state.selectedSlot = null;
                state.highlightedSlotStart = null;
                rerenderCalendar();
            });
            panel.appendChild(backBtn);
        }

        const heading = document.createElement('h3');
        heading.className = 'job-hunt-times-heading';
        const durationLabel =
            state.selectedOffer === 'free_trial'
                ? ` · ${offerDurationMinutes()} min`
                : '';
        heading.textContent = formatSelectedDayLabel(state.selectedDate) + durationLabel;
        panel.appendChild(heading);

        const list = document.createElement('div');
        list.className = 'job-hunt-times-list';
        list.setAttribute('role', 'list');

        const daySlots = getSlotsForDay(slots, state.selectedDate).filter((slot) => {
            const start = new Date(slot.start);
            if (start.getTime() <= Date.now()) return false;
            if (state.pendingSlot) {
                const pendingStart = new Date(state.pendingSlot.start).getTime();
                const pendingEnd = new Date(state.pendingSlot.end || state.pendingSlot.start).getTime();
                const end = new Date(slot.end).getTime();
                if (start.getTime() < pendingEnd && end > pendingStart) return false;
            }
            return true;
        });

        if (state.pendingSlot && isSameCalendarDay(new Date(state.pendingSlot.start), state.selectedDate)) {
            const pendingRow = document.createElement('div');
            pendingRow.className = 'job-hunt-time-row job-hunt-time-row--pending';
            pendingRow.setAttribute('role', 'listitem');
            pendingRow.innerHTML =
                `<button type="button" class="job-hunt-time-btn job-hunt-time-btn--pending" disabled>` +
                `${formatTimeFromDate(new Date(state.pendingSlot.start))}` +
                `</button>` +
                `<span class="job-hunt-slot-pending-spinner" aria-hidden="true"></span>`;
            pendingRow.setAttribute('aria-label', 'Booking in progress');
            list.appendChild(pendingRow);
            panel.appendChild(list);
            return panel;
        }

        if (!daySlots.length) {
            const empty = document.createElement('p');
            empty.className = 'job-hunt-times-empty';
            empty.textContent = 'No times available';
            panel.appendChild(empty);
            return panel;
        }

        daySlots.forEach((slot) => {
            const row = document.createElement('div');
            row.className = 'job-hunt-time-row';
            row.setAttribute('role', 'listitem');

            const timeBtn = document.createElement('button');
            timeBtn.type = 'button';
            timeBtn.className = 'job-hunt-time-btn';
            timeBtn.textContent = formatTimeFromDate(new Date(slot.start));
            timeBtn.setAttribute(
                'aria-label',
                `Book ${formatTimeFromDate(new Date(slot.start))}`
            );
            timeBtn.addEventListener('click', () => {
                if (state.pendingSlot) return;
                selectSlot(slot);
            });
            row.appendChild(timeBtn);

            list.appendChild(row);
        });

        panel.appendChild(list);
        return panel;
    }

    function offerTitle() {
        if (state.selectedOffer === 'free_trial') return 'Free trial kickoff';
        return 'Paid consultation';
    }

    function offerPriceLabel() {
        if (state.selectedOffer === 'free_trial') return 'Free';
        return `R${state.regularPriceZar || 500}`;
    }

    function renderLocaleControls(panel) {
        const wrap = document.createElement('div');
        wrap.className = 'job-hunt-locale-controls';

        const tzLabel = document.createElement('label');
        tzLabel.className = 'job-hunt-locale-field';
        tzLabel.innerHTML = '<span>Timezone</span>';
        const tzSelect = document.createElement('select');
        tzSelect.className = 'job-hunt-locale-select';
        tzSelect.setAttribute('aria-label', 'Timezone for times');
        const zones = COMMON_TIMEZONES.slice();
        if (state.customerTimezone && zones.indexOf(state.customerTimezone) === -1) {
            zones.unshift(state.customerTimezone);
        }
        zones.forEach((tz) => {
            const opt = document.createElement('option');
            opt.value = tz;
            opt.textContent = timezoneLabel(tz);
            if (tz === state.customerTimezone) opt.selected = true;
            tzSelect.appendChild(opt);
        });
        tzSelect.addEventListener('change', () => {
            state.customerTimezone = tzSelect.value;
            writeCookie(TZ_COOKIE, state.customerTimezone);
            rerenderCalendar();
        });
        tzLabel.appendChild(tzSelect);
        wrap.appendChild(tzLabel);

        const hint = document.createElement('p');
        hint.className = 'job-hunt-calendly-timezone';
        hint.textContent =
            `Times shown in ${timezoneLabel(state.customerTimezone)} · Host is on SAST`;
        wrap.appendChild(hint);

        panel.appendChild(wrap);
    }

    function renderDetailsPanel() {
        const panel = document.createElement('aside');
        panel.className = 'job-hunt-calendly-details';
        panel.setAttribute('aria-label', 'Meeting details');

        const host = document.createElement('p');
        host.className = 'job-hunt-calendly-host';
        host.textContent = 'Time Exchange';
        panel.appendChild(host);

        const title = document.createElement('h2');
        title.className = 'job-hunt-calendly-title';
        title.textContent = offerTitle();
        panel.appendChild(title);

        const meta = document.createElement('ul');
        meta.className = 'job-hunt-calendly-meta';

        const durationItem = document.createElement('li');
        durationItem.innerHTML =
            '<i class="fa fa-clock-o" aria-hidden="true"></i>' +
            `<span>${offerDurationMinutes()} min</span>`;
        meta.appendChild(durationItem);

        const priceItem = document.createElement('li');
        priceItem.innerHTML =
            '<i class="fa fa-tag" aria-hidden="true"></i>' +
            `<span>${offerPriceLabel()}</span>`;
        meta.appendChild(priceItem);

        const confItem = document.createElement('li');
        confItem.innerHTML =
            '<i class="fa fa-video-camera" aria-hidden="true"></i>' +
            '<span>Web conferencing details provided upon confirmation</span>';
        meta.appendChild(confItem);

        if (state.selectedDate) {
            const whenItem = document.createElement('li');
            whenItem.className = 'job-hunt-calendly-meta-when';
            const slot =
                (state.highlightedSlotStart &&
                    (state.availabilitySlots || []).find((s) => s.start === state.highlightedSlotStart)) ||
                state.selectedSlot ||
                state.pendingSlot;
            const whenText = slot
                ? formatSlotLabel(slot.start, slot.end || addMinutesIso(slot.start, offerDurationMinutes()))
                : formatSelectedDayLabel(state.selectedDate);
            whenItem.innerHTML =
                '<i class="fa fa-calendar" aria-hidden="true"></i>' +
                `<span>${whenText}</span>`;
            meta.appendChild(whenItem);
        }

        panel.appendChild(meta);
        renderLocaleControls(panel);

        return panel;
    }

    function renderCalendarGrid(slots) {
        const root = document.createElement('div');
        root.className =
            'job-hunt-calendly' + (state.selectedDate ? ' job-hunt-calendly--has-date' : '');

        root.appendChild(renderDetailsPanel());

        const picker = document.createElement('div');
        picker.className = 'job-hunt-calendly-picker';

        const monthNav = document.createElement('div');
        monthNav.className = 'job-hunt-month-nav';

        const prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.className = 'job-hunt-month-nav-btn';
        prevBtn.id = 'jobHuntPrevWeek';
        prevBtn.setAttribute('aria-label', 'Previous month');
        prevBtn.innerHTML = '<span aria-hidden="true">&lsaquo;</span>';

        const monthLabel = document.createElement('span');
        monthLabel.className = 'job-hunt-month-label';
        monthLabel.id = 'jobHuntMonthLabel';
        monthLabel.textContent = formatMonthLabel(state.viewMonth);

        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'job-hunt-month-nav-btn';
        nextBtn.id = 'jobHuntNextWeek';
        nextBtn.setAttribute('aria-label', 'Next month');
        nextBtn.innerHTML = '<span aria-hidden="true">&rsaquo;</span>';

        const currentMonth = startOfMonth(new Date());
        const atCurrentMonth =
            state.viewMonth.getFullYear() === currentMonth.getFullYear() &&
            state.viewMonth.getMonth() === currentMonth.getMonth();
        prevBtn.disabled = !!state.pendingSlot || atCurrentMonth;
        nextBtn.disabled = !!state.pendingSlot;

        prevBtn.addEventListener('click', () => {
            state.viewMonth = addMonths(state.viewMonth, -1);
            state.selectedDate = null;
            state.highlightedSlotStart = null;
            fetchAvailability();
        });
        nextBtn.addEventListener('click', () => {
            state.viewMonth = addMonths(state.viewMonth, 1);
            state.selectedDate = null;
            state.highlightedSlotStart = null;
            fetchAvailability();
        });

        monthNav.appendChild(prevBtn);
        monthNav.appendChild(monthLabel);
        monthNav.appendChild(nextBtn);
        picker.appendChild(monthNav);

        els.monthLabel = monthLabel;
        els.prevMonth = prevBtn;
        els.nextMonth = nextBtn;

        picker.appendChild(renderMonthGrid(slots));
        root.appendChild(picker);
        root.appendChild(renderTimesPanel(slots));
        return root;
    }

    function selectDate(day) {
        state.selectedDate = startOfDay(day);
        state.selectedSlot = null;
        state.highlightedSlotStart = null;
        showStep(els.stepCalendar);
        rerenderCalendar();
    }

    function cacheElements() {
        els.app = document.getElementById('jobHuntBookingApp');
        if (!els.app) return false;

        els.stepCalendar = document.getElementById('jobHuntStepCalendar');
        els.stepForm = document.getElementById('jobHuntStepForm');
        els.stepConfirmed = document.getElementById('jobHuntStepConfirmed');
        els.bookingSection = document.getElementById('book-consultation');
        els.monthLabel = null;
        els.slotsLoading = document.getElementById('jobHuntSlotsLoading');
        els.slotsError = document.getElementById('jobHuntSlotsError');
        els.slotsGrid = document.getElementById('jobHuntSlotsGrid');
        els.prevMonth = null;
        els.nextMonth = null;
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

    function updateMonthNavState() {
        const lockNav = !!state.pendingSlot;
        const currentMonth = startOfMonth(new Date());
        const atCurrentMonth =
            state.viewMonth.getFullYear() === currentMonth.getFullYear() &&
            state.viewMonth.getMonth() === currentMonth.getMonth();
        if (els.prevMonth) els.prevMonth.disabled = lockNav || atCurrentMonth;
        if (els.nextMonth) els.nextMonth.disabled = lockNav;
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
            const pendingStart = new Date(state.pendingSlot.start);
            state.viewMonth = startOfMonth(pendingStart);
            state.selectedDate = startOfDay(pendingStart);
            if (els.monthLabel) {
                els.monthLabel.textContent = formatMonthLabel(state.viewMonth);
            }
        }
        if (!state.selectedOffer) state.selectedOffer = 'paid';
        if (els.bookingSection) els.bookingSection.hidden = false;
        if (els.app) els.app.hidden = false;
        setSelectedOfferUi(state.selectedOffer);
        showStep(els.stepCalendar);
        if (state.availabilitySlots) {
            rerenderCalendar();
        } else {
            fetchAvailability();
        }
        updateMonthNavState();
        updatePendingActionsVisibility();
    }

    function clearCalendarPending() {
        clearPendingSlot();
        clearAwaitingConfirmation();
        rerenderCalendar();
        updateMonthNavState();
        updatePendingActionsVisibility();
    }

    async function fetchAvailability() {
        els.slotsLoading.hidden = false;
        els.slotsError.hidden = true;
        els.slotsGrid.hidden = true;
        els.slotsGrid.innerHTML = '';
        if (els.monthLabel) {
            els.monthLabel.textContent = formatMonthLabel(state.viewMonth);
        }
        if (els.prevMonth) els.prevMonth.disabled = true;
        if (els.nextMonth) els.nextMonth.disabled = true;

        const now = new Date();
        const monthStart = state.viewMonth;
        const rangeStart = monthStart < now ? now : monthStart;
        const rangeEnd = addMonths(monthStart, 1);

        const offer =
            state.selectedOffer === 'free_trial' || state.selectedOffer === 'paid'
                ? state.selectedOffer
                : 'paid';

        try {
            const res = await fetch(
                `${API_BASE}/consultations/availability?from=${encodeURIComponent(toIsoUtc(rangeStart))}&to=${encodeURIComponent(toIsoUtc(rangeEnd))}&offer=${encodeURIComponent(offer)}`
            );
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Could not load availability');
            }

            if (typeof data.priceZar === 'number') {
                state.priceZar = data.priceZar;
            }
            if (typeof data.regularPriceZar === 'number') {
                state.regularPriceZar = data.regularPriceZar;
            }
            if (typeof data.freeFirstPromo === 'boolean') {
                state.freeFirstPromo = data.freeFirstPromo;
            }
            if (typeof data.durationMinutes === 'number') {
                state.durationMinutes = data.durationMinutes;
            }
            if (typeof data.freeTrialDurationMinutes === 'number') {
                state.freeTrialDurationMinutes = data.freeTrialDurationMinutes;
            }
            if (typeof data.paidDurationMinutes === 'number') {
                state.paidDurationMinutes = data.paidDurationMinutes;
            }
            if (data.hostTimezone) {
                state.hostTimezone = data.hostTimezone;
            }
            // Always force trial duration locally so UI/booking stay at 30 minutes.
            if (offer === 'free_trial') {
                state.durationMinutes = state.freeTrialDurationMinutes || 30;
            }
            updatePriceLabels();

            els.slotsLoading.hidden = true;
            const slots = normalizeSlotsForOffer(data.slots || []);
            state.availabilitySlots = slots;

            if (state.pendingSlot) {
                state.selectedDate = startOfDay(new Date(state.pendingSlot.start));
            } else {
                state.selectedDate = null;
            }

            els.slotsGrid.appendChild(renderCalendarGrid(slots));
            els.slotsGrid.hidden = false;

            if (!slots.length) {
                els.slotsError.textContent = 'No open slots this month. Try another month.';
                els.slotsError.hidden = false;
            }
        } catch (err) {
            els.slotsLoading.hidden = true;
            els.slotsError.textContent = err.message || 'Failed to load times.';
            els.slotsError.hidden = false;
        } finally {
            updateMonthNavState();
        }
    }

    function selectSlot(slot) {
        const payload = bookingSlotPayload(slot);
        state.selectedSlot = { start: payload.slotStart, end: payload.slotEnd };
        els.selectedSlot.textContent = formatSlotLabel(payload.slotStart, payload.slotEnd);
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
        if (state.selectedOffer === 'free_trial') {
            return 'Book free consultation';
        }
        if (state.selectedOffer === 'paid') {
            return `Book kickoff for R${state.regularPriceZar || 500}`;
        }
        if (state.freeFirstPromo || state.priceZar <= 0) {
            return 'Book free consultation';
        }
        return `Book kickoff for R${state.priceZar}`;
    }

    function updatePriceLabels() {
        document.querySelectorAll('[data-job-hunt-price]').forEach((el) => {
            el.textContent = state.priceZar <= 0 ? 'Free' : `R${state.priceZar}`;
        });
        document.querySelectorAll('[data-job-hunt-regular-price]').forEach((el) => {
            el.textContent = `R${state.regularPriceZar}`;
        });
        const priceEl = document.querySelector(
            '[data-job-hunt-offer="paid"] .job-hunt-offer-card-price'
        );
        if (priceEl) {
            priceEl.textContent = `R${state.regularPriceZar || 500}`;
        }
        const submitBtn = document.getElementById('jobHuntSubmitBooking');
        if (submitBtn && !submitBtn.disabled) {
            submitBtn.textContent = formatBookLabel();
        }
    }

    function setSelectedOfferUi(offer) {
        document.querySelectorAll('[data-job-hunt-offer]').forEach((card) => {
            card.classList.toggle(
                'job-hunt-offer-card--selected',
                card.getAttribute('data-job-hunt-offer') === offer
            );
        });
    }

    function openTimeXBooking() {
        const ua = navigator.userAgent || '';
        const ios = /iPhone|iPad|iPod/i.test(ua);
        const android = /Android/i.test(ua);

        if (android) {
            window.location.href = TIMEX_ANDROID_INTENT;
            return;
        }

        if (ios) {
            let leftPage = false;
            const onHide = () => {
                leftPage = true;
            };
            document.addEventListener('visibilitychange', onHide);
            window.addEventListener('pagehide', onHide);
            window.addEventListener('blur', onHide);

            const start = Date.now();
            window.location.href = TIMEX_DEEP_LINK;
            setTimeout(() => {
                document.removeEventListener('visibilitychange', onHide);
                window.removeEventListener('pagehide', onHide);
                window.removeEventListener('blur', onHide);
                if (leftPage || document.hidden) return;
                if (Date.now() - start < 2200) {
                    window.location.href = TIMEX_IOS_STORE;
                }
            }, 1600);
            return;
        }

        // Desktop / unknown: share-link page can still deep-link if the app is installed
        window.location.href = TIMEX_REQUEST_URL;
    }

    function selectOffer(offer) {
        if (offer === 'timex') {
            openTimeXBooking();
            return;
        }

        state.selectedOffer = offer;
        state.selectedDate = null;
        state.selectedSlot = null;
        state.highlightedSlotStart = null;
        setSelectedOfferUi(offer);

        if (els.bookingSection) els.bookingSection.hidden = false;

        if (els.app) els.app.hidden = false;
        state.availabilitySlots = null;
        updatePriceLabels();
        showStep(els.stepCalendar);
        fetchAvailability();
        els.bookingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        const isPaidOffer = state.selectedOffer === 'paid';
        submitBtn.textContent = isPaidOffer
            ? 'Continuing to secure payment…'
            : 'Confirming your free session…';
        let redirectingToCheckout = false;
        let confirmedFree = false;

        try {
            const slotPayload = bookingSlotPayload(state.selectedSlot);
            state.selectedSlot = { start: slotPayload.slotStart, end: slotPayload.slotEnd };

            const res = await fetch(`${API_BASE}/consultations/book`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slotStart: slotPayload.slotStart,
                    slotEnd: slotPayload.slotEnd,
                    name,
                    email,
                    phone: phone || undefined,
                    notes: notes || undefined,
                    offer: state.selectedOffer === 'paid' ? 'paid' : 'free_trial',
                    durationMinutes: offerDurationMinutes(),
                    customerTimezone: state.customerTimezone || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Booking failed');
            }

            state.bookingId = data.bookingId;
            storeBookingEmail(email);

            if (data.status === 'confirmed' || data.promo === 'free_first' || !data.checkoutRedirectUrl) {
                if (data.status === 'confirmed' || data.promo === 'free_first') {
                    clearPendingBookingState();
                    const booking = data.booking || {};
                    const slotStart = booking.slotStart || state.selectedSlot.start;
                    const slotEnd = booking.slotEnd || state.selectedSlot.end;
                    els.confirmedMessage.textContent = formatSlotLabel(slotStart, slotEnd);
                    showStep(els.stepConfirmed);
                    confirmedFree = true;
                    return;
                }
                throw new Error(
                    'Payment could not be started. The server may be missing YOCO_SECRET_KEY — please contact support.'
                );
            }

            redirectingToCheckout = beginYocoCheckout(data.checkoutRedirectUrl, data.bookingId);
        } catch (err) {
            const message = err.message || 'Could not create booking.';
            els.formError.textContent = message;
            els.formError.hidden = false;
            if (/no longer available|already booked|temporarily reserved/i.test(message)) {
                state.selectedSlot = null;
                state.highlightedSlotStart = null;
                fetchAvailability().then(() => {
                    showStep(els.stepCalendar);
                });
            }
        } finally {
            if (!redirectingToCheckout && !confirmedFree) {
                submitBtn.disabled = false;
                submitBtn.textContent = formatBookLabel();
            }
        }
    }

    function bindEvents() {
        document.querySelectorAll('[data-job-hunt-offer]').forEach((card) => {
            card.addEventListener('click', (event) => {
                const offer = card.getAttribute('data-job-hunt-offer');
                if (offer === 'timex') {
                    event.preventDefault();
                }
                selectOffer(offer);
            });
        });
        els.backToSlots.addEventListener('click', () => {
            showStep(els.stepCalendar);
            fetchAvailability();
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

        let compact = isCompactCalendar();
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                const next = isCompactCalendar();
                if (next !== compact) {
                    compact = next;
                    if (els.stepCalendar && !els.stepCalendar.hidden && state.availabilitySlots) {
                        rerenderCalendar();
                    }
                }
            }, 150);
        });
    }

    function initJobHuntBooking() {
        if (!cacheElements()) return;
        initLocalePrefs();
        bindEvents();
        state.selectedOffer = 'paid';
        setSelectedOfferUi('paid');
        if (els.bookingSection) els.bookingSection.hidden = false;
        if (els.app) els.app.hidden = false;
        updatePriceLabels();
        handlePaymentReturn();
        if (!getReturnParams().get('payment') && !sessionStorage.getItem(PENDING_BOOKING_KEY)) {
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
            if (
                els.app &&
                state.selectedOffer &&
                state.selectedOffer !== 'timex' &&
                els.slotsGrid &&
                !els.slotsGrid.innerHTML &&
                !getReturnParams().get('payment')
            ) {
                if (els.bookingSection) els.bookingSection.hidden = false;
                if (els.app) els.app.hidden = false;
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
