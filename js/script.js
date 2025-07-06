// Page navigation functionality
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
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

        // Platinum Plan - $29.99/month
        paypal.Buttons({
            style: {
                layout: 'vertical',
                color: 'silver',
                shape: 'rect',
                label: 'subscribe'
            },
            createSubscription: function(data, actions) {
                return actions.subscription.create({
                    'plan_id': 'P-1PN742989W4772118NBACUAQ'
                });
            },
            onApprove: function(data, actions) {
                console.log('Platinum subscription approved:', data);
                alert('Thank you for subscribing to Platinum! Your subscription is now active.');
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
        
        // Simulate processing time
        setTimeout(() => {
            alert('Welcome to timeXchange! Your free account has been created.');
            resetLoading();
        }, 1000);
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

// Add CSS for notification animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
`;
document.head.appendChild(style); 