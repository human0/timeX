// Page navigation functionality
function showPage(pageId, updateHash = true) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Show the selected page
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
        
        // Update URL hash only if requested and different from current
        if (updateHash) {
            const currentHash = window.location.hash.slice(1);
            if (currentHash !== pageId) {
                window.location.hash = pageId;
            }
        }
    }
}

// Handle URL hash changes
function handleHashChange() {
    const hash = window.location.hash.slice(1);
    const validPages = ['home', 'about', 'policies'];
    
    if (hash && validPages.includes(hash)) {
        showPage(hash, false); // Don't update hash to prevent infinite loop
    } else {
        // Default to home page if no valid hash
        showPage('home', false); // Don't update hash to prevent infinite loop
    }
}

// Initialize page based on URL hash on page load
function initializePageFromHash() {
    const hash = window.location.hash.slice(1);
    const validPages = ['home', 'about', 'policies'];
    
    if (hash && validPages.includes(hash)) {
        showPage(hash);
    } else {
        // Default to home page
        showPage('home');
    }
}

// PayPal Integration
let paypalLoaded = false;

function initializePayPal() {
    if (typeof paypal !== 'undefined' && !paypalLoaded) {
        paypalLoaded = true;
        
        // Gold Plan - $9.99/month
        paypal.Buttons({
            style: {
                layout: 'vertical',
                color: 'gold',
                shape: 'rect',
                label: 'subscribe'
            },
            createSubscription: function(data, actions) {
                return actions.subscription.create({
                    'plan_id': 'P-94424733EF0039708NBME2XI'
                });
            },
            onApprove: function(data, actions) {
                console.log('Gold subscription approved:', data);
                alert('Thank you for subscribing to Gold! Your subscription is now active.');
                // Here you would typically send the subscription ID to your server
            },
            onError: function(err) {
                console.error('PayPal error:', err);
                alert('There was an error processing your subscription. Please try again.');
            }
        }).render('#paypal-gold');

        // Black Plan - $295.99/month
        paypal.Buttons({
            style: {
                layout: 'vertical',
                color: 'black',
                shape: 'rect',
                label: 'subscribe'
            },
            createSubscription: function(data, actions) {
                return actions.subscription.create({
                    'plan_id': 'P-1PN742989W4772118NBACUAQ'
                });
            },
            onApprove: function(data, actions) {
                console.log('Black subscription approved:', data);
                alert('Thank you for subscribing to Black! Your subscription is now active.');
                // Here you would typically send the subscription ID to your server
            },
            onError: function(err) {
                console.error('PayPal error:', err);
                alert('There was an error processing your subscription. Please try again.');
            }
        }).render('#paypal-platinum');
    }
}

// Check if PayPal is loaded and initialize
function checkPayPalAndInitialize() {
    if (typeof paypal !== 'undefined') {
        initializePayPal();
    } else {
        // Retry after a short delay
        setTimeout(checkPayPalAndInitialize, 100);
    }
}

// Contact form handling
function handleContactForm(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const name = formData.get('name');
    const email = formData.get('email');
    const subject = formData.get('subject');
    const message = formData.get('message');
    
    // Basic validation
    if (!name || !email || !subject || !message) {
        alert('Please fill in all fields.');
        return;
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert('Please enter a valid email address.');
        return;
    }
    
    // Here you would typically send the form data to your server
    console.log('Contact form submitted:', { name, email, subject, message });
    
    // Show success message
    alert('Thank you for your message! We will get back to you soon.');
    
    // Reset form
    event.target.reset();
}

// Initialize page functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize page from URL hash
    initializePageFromHash();
    
    // Add hashchange event listener
    window.addEventListener('hashchange', handleHashChange);
    
    // Initialize PayPal
    checkPayPalAndInitialize();
    
    // Add contact form event listener
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', handleContactForm);
    }
    
    // Add smooth scrolling animation on page load
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animation = 'fadeInUp 0.8s ease-out';
            }
        });
    }, observerOptions);

    // Observe elements for animation
    document.querySelectorAll('.feature-card, .plan-card, .team-member, .contact-item, .policy-section, .security-section').forEach(el => {
        observer.observe(el);
    });
    
    // Create sparkles for subscription plans
    createSparkles();

    // Email verification logic
    const token = getQueryParam('token');
    if (token) {
        showVerifyingModal();
        fetch(`https://tbserver-1059280513734.africa-south1.run.app/auth/verify-email?token=${encodeURIComponent(token)}`)
            .then(res => res.json().then(data => ({ ok: res.ok, data })))
            .then(({ ok, data }) => {
                hideVerifyingModal();
                
                // Log response for debugging
                console.log('Verification response:', { status: ok, data });
                
                // Check for success message (server returns data.message on success)
                if (data.message) {
                    console.log('Verification successful!');
                    document.getElementById('welcomeModal').style.display = 'flex';
                    centerWelcomeModal();
                } else {
                    console.error('Verification error:', data.error);
                    showVerificationModal(data.error || 'Verification failed. The link may be invalid or expired.', false);
                }
            })
            .catch((err) => {
                console.error('Verification error:', err);
                hideVerifyingModal();
                showVerificationModal('A network error occurred. Please try again later.', false);
            });
    }
});

// Add navbar background on scroll
window.addEventListener('scroll', function() {
    const nav = document.querySelector('nav');
    if (window.scrollY > 50) {
        nav.style.background = 'rgba(255, 255, 255, 0.95)';
    } else {
        nav.style.background = 'rgba(255, 255, 255, 0.1)';
    }
});

// Smooth scroll to sections
function scrollToSection(sectionId) {
    const element = document.getElementById(sectionId);
    if (element) {
        element.scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// Add loading states for buttons
function addLoadingState(button) {
    const originalText = button.textContent;
    button.textContent = 'Processing...';
    button.disabled = true;
    
    return function() {
        button.textContent = originalText;
        button.disabled = false;
    };
}

// Handle "Get Started" button for free plan
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('get-started-btn')) {
        const resetLoading = addLoadingState(e.target);

        // Show signup modal instead of alert
        if (typeof openModal === "function") {
            openModal();
            resetLoading();
        } else {
            setTimeout(() => {
                alert('Welcome to timeXchange! Your free account has been created.');
                resetLoading();
            }, 1000);
        }
    }
});

// Handle signup form with API POST
document.addEventListener('DOMContentLoaded', function() {
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const name = document.getElementById('signupName').value.trim();
            const email = document.getElementById('signupEmail').value.trim();
            const password = document.getElementById('signupPassword').value;
            const password2 = document.getElementById('signupPassword2').value;
            const errorDiv = document.getElementById('signupError');
            errorDiv.style.display = 'none';
            errorDiv.textContent = '';

            if (password !== password2) {
                errorDiv.textContent = "Passwords do not match.";
                errorDiv.style.display = 'block';
                return;
            }
            if (password.length < 6) {
                errorDiv.textContent = "Password must be at least 6 characters.";
                errorDiv.style.display = 'block';
                return;
            }

            try {
                const res = await fetch('https://tbserver-1059280513734.africa-south1.run.app/auth/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password })
                });
                const data = await res.json();
                
                // Log response for debugging
                console.log('Signup response:', { status: res.status, ok: res.ok, data });
                
                // Check API response for success (your API returns data.success boolean)
                if (data.success) {
                    console.log('Signup successful!');
                    document.getElementById('signupSuccess').style.display = 'block';
                    signupForm.reset();
                    errorDiv.textContent = "";
                    setTimeout(() => {
                        closeModal();
                    }, 1200);
                } else {
                    console.error('Error:', data.error);
                    errorDiv.textContent = data.error || "Signup failed. Please try again.";
                    errorDiv.style.display = 'block';
                }
            } catch (err) {
                console.error('Signup error:', err);
                errorDiv.textContent = "Network error. Please try again.";
                errorDiv.style.display = 'block';
            }
        });
    }
});

// Add copy functionality for contact information
document.addEventListener('click', function(e) {
    if (e.target.closest('.contact-details')) {
        const contactText = e.target.closest('.contact-details').textContent.trim();
        navigator.clipboard.writeText(contactText).then(() => {
            // Show a subtle notification
            const notification = document.createElement('div');
            notification.textContent = 'Copied to clipboard!';
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #10b981;
                color: white;
                padding: 0.5rem 1rem;
                border-radius: 5px;
                z-index: 10000;
                animation: slideIn 0.3s ease-out;
            `;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.remove();
            }, 2000);
        });
    }
});

window.addEventListener('scroll', function() {
    const nav = document.getElementById('mainNav');
    if (window.scrollY > 10) {
        nav.classList.add('nav-transparent');
    } else {
        nav.classList.remove('nav-transparent');
    }
});

// Add CSS for notification animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
`;
document.head.appendChild(style);

// Add closeWelcomeModal function
function closeWelcomeModal() {
    document.getElementById('welcomeModal').style.display = 'none';
}

// Toggle PayPal buttons based on terms acceptance
function togglePayPalButton(planType) {
    const checkbox = document.getElementById(`terms-${planType}`);
    const paypalContainer = document.getElementById(`paypal-${planType}`);
    
    if (checkbox.checked) {
        paypalContainer.style.opacity = '1';
        paypalContainer.style.pointerEvents = 'auto';
    } else {
        paypalContainer.style.opacity = '0.5';
        paypalContainer.style.pointerEvents = 'none';
    }
}

// Create floating sparkles for subscription plans
function createSparkles() {
    const goldPlan = document.querySelector('.plan-card.gold');
    const platinumPlan = document.querySelector('.plan-card.platinum');
    
    // Create sparkles for Gold plan
    for (let i = 0; i < 8; i++) {
        const sparkle = document.createElement('div');
        sparkle.className = 'sparkle';
        sparkle.style.left = Math.random() * 100 + '%';
        sparkle.style.top = Math.random() * 100 + '%';
        sparkle.style.animationDelay = Math.random() * 6 + 's';
        sparkle.style.animationDuration = (4 + Math.random() * 4) + 's';
        goldPlan.appendChild(sparkle);
    }
    
    // Create sparkles for Platinum plan
    for (let i = 0; i < 10; i++) {
        const sparkle = document.createElement('div');
        sparkle.className = 'sparkle';
        sparkle.style.left = Math.random() * 100 + '%';
        sparkle.style.top = Math.random() * 100 + '%';
        sparkle.style.animationDelay = Math.random() * 6 + 's';
        sparkle.style.animationDuration = (5 + Math.random() * 5) + 's';
        platinumPlan.appendChild(sparkle);
    }
}

// Utility: Get URL parameter
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// Utility: Center modal helper
function centerModalStyle(modal) {
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.zIndex = '10000';
    modal.style.background = 'rgba(0,0,0,0.4)';
}

// Show verification result modal
function showVerificationModal(message, isSuccess) {
    let modal = document.getElementById('verifyModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'verifyModal';
        modal.className = 'modal';
        centerModalStyle(modal);
        modal.innerHTML = `
          <div class="modal-content" style="text-align:center; max-width: 90vw; margin: 0 auto;">
            <span class="close-modal" onclick="document.getElementById('verifyModal').style.display='none'">&times;</span>
            <h2>${isSuccess ? 'Email Verified!' : 'Verification Failed'}</h2>
            <p>${message}</p>
            <button onclick="document.getElementById('verifyModal').style.display='none'">Close</button>
          </div>
        `;
        document.body.appendChild(modal);
    } else {
        centerModalStyle(modal);
        modal.querySelector('h2').textContent = isSuccess ? 'Email Verified!' : 'Verification Failed';
        modal.querySelector('p').textContent = message;
        modal.style.display = 'flex';
    }
}

// Show verifying modal with spinner
function showVerifyingModal() {
    let modal = document.getElementById('verifyingModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'verifyingModal';
        modal.className = 'modal';
        centerModalStyle(modal);
        modal.innerHTML = `
          <div class="modal-content" style="text-align:center; max-width: 90vw; margin: 0 auto;">
            <div style="margin: 2em 0;">
              <div class="spinner" style="margin-bottom: 1em; width: 40px; height: 40px; border: 4px solid #ccc; border-top: 4px solid #10b981; border-radius: 50%; animation: spin 1s linear infinite;"></div>
              <p>Verifying your email, please wait...</p>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
        // Add spinner animation CSS if not present
        if (!document.getElementById('spinner-style')) {
            const style = document.createElement('style');
            style.id = 'spinner-style';
            style.textContent = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
            document.head.appendChild(style);
        }
    } else {
        centerModalStyle(modal);
        modal.style.display = 'flex';
    }
}

function hideVerifyingModal() {
    const modal = document.getElementById('verifyingModal');
    if (modal) modal.style.display = 'none';
}

// Ensure welcomeModal is centered when shown
function centerWelcomeModal() {
    const modal = document.getElementById('welcomeModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100vw';
        modal.style.height = '100vh';
        modal.style.zIndex = '10000';
        modal.style.background = 'rgba(0,0,0,0.4)';
    }
}

// Patch: Whenever welcomeModal is shown, center it
const origShowWelcome = document.getElementById('welcomeModal')?.style.display;
Object.defineProperty(document.getElementById('welcomeModal') || {}, 'style', {
    set: function(val) {
        this._style = val;
        if (val && val.display === 'flex') centerWelcomeModal();
    },
    get: function() { return this._style; }
});