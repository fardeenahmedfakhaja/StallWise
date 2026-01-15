// Restaurant Order Management System with Firebase - CORRECTED TAB NAVIGATION
class RestaurantOrderSystem {
    constructor() {
        // Firebase services
        this.auth = firebase.auth();
        this.db = firebase.firestore();
        this.storage = firebase.storage();
        this.googleProvider = new firebase.auth.GoogleAuthProvider();
        
        // Current user data
        this.currentUser = null;
        this.userData = null;
        this.businessId = null;
        
        // Initialize data from local storage as fallback
        this.menu = this.loadData('menu') || this.getDefaultMenu();
        this.categories = this.loadData('categories') || this.getDefaultCategories();
        this.orders = this.loadData('orders') || [];
        this.completedOrders = this.loadData('completedOrders') || [];
        this.nextOrderId = this.loadData('nextOrderId') || 1001;
        
        // Current order state
        this.currentOrder = {
            items: [],
            customerName: '',
            customerPhone: '',
            orderType: 'dine-in',
            paymentMethod: 'cash',
            notes: ''
        };
        
        // Chart instances
        this.revenueProfitChart = null;
        this.categoryRevenueChart = null;
        this.categoryProfitChart = null;
        this.topItemsRevenueChart = null;
        this.categoryItemCharts = {};
        
        // Initialize
        this.init();
    }
    
    // Default menu items with cost
    getDefaultMenu() {
        return [
            // APPETIZERS
            { id: 1, category: 'APPETIZERS', name: 'Chicken loaded fries', price: 140, cost: 70 },
            { id: 2, category: 'APPETIZERS', name: 'Cheesy veg loaded fries', price: 125, cost: 60 },
            { id: 3, category: 'APPETIZERS', name: 'Salted fries', price: 99, cost: 40 },
            { id: 4, category: 'APPETIZERS', name: 'Peri peri fries', price: 109, cost: 45 },
            { id: 5, category: 'APPETIZERS', name: 'Chicken Nuggets (4 pcs)', price: 75, cost: 35 },
            { id: 6, category: 'APPETIZERS', name: 'Chicken Nuggets (6 pcs)', price: 99, cost: 50 },
            
            // WRAPS
            { id: 7, category: 'WRAPS', name: 'Chicken tikka wrap', price: 130, cost: 60 },
            { id: 8, category: 'WRAPS', name: 'Paneer tikka wrap', price: 120, cost: 55 },
            { id: 9, category: 'WRAPS', name: 'Chicken zinger wrap', price: 150, cost: 70 },
            { id: 10, category: 'WRAPS', name: 'Chicken nugget wrap', price: 120, cost: 55 },
            
            // BURGERS
            { id: 11, category: 'BURGERS', name: 'Classic Veg burger', price: 115, cost: 50 },
            { id: 12, category: 'BURGERS', name: 'Chicken Bliss burger', price: 135, cost: 60 },
            
            // SALADS
            { id: 13, category: 'SALADS', name: 'Veg salad', price: 99, cost: 40 },
            { id: 14, category: 'SALADS', name: 'Signature chicken salad', price: 130, cost: 55 },
            
            // DESSERTS
            { id: 15, category: 'DESSERTS', name: 'Chocolate brownie', price: 90, cost: 35 },
            { id: 16, category: 'DESSERTS', name: 'Red velvet brownie', price: 90, cost: 35 },
            { id: 17, category: 'DESSERTS', name: 'Lotus biscoff drip brownie', price: 130, cost: 50 },
            { id: 18, category: 'DESSERTS', name: 'Strawberry choco brownie', price: 110, cost: 45 },
            { id: 19, category: 'DESSERTS', name: 'Chocolate strawberry cup', price: 120, cost: 50 }
        ];
    }
    
    // Default categories
    getDefaultCategories() {
        return [
            'APPETIZERS',
            'WRAPS', 
            'BURGERS',
            'SALADS',
            'DESSERTS'
        ];
    }
    
    // Local storage methods (fallback)
    saveData(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Error saving data:', e);
            return false;
        }
    }
    
    loadData(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Error loading data:', e);
            return null;
        }
    }
    
    // Initialize the system
    init() {
        this.setupTabNavigation();
        this.initAuth();
        this.initEventListeners();
        this.renderMenu();
        this.updateSummary();
        this.updateStats();
        this.updateBadges();
        this.updateNextOrderNumber();
    }
    
    // Setup tab navigation - SIMPLIFIED
    setupTabNavigation() {
        // Hide all tab contents first
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.style.display = 'none';
        });
        
        // Show only the active tab
        const activeTab = document.querySelector('.tab-content.active');
        if (activeTab) {
            activeTab.style.display = 'block';
        } else {
            // Default to take-order tab
            const defaultTab = document.getElementById('take-order');
            if (defaultTab) {
                defaultTab.style.display = 'block';
                defaultTab.classList.add('active');
            }
        }
        
        // Set up click handlers for nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const tabId = link.getAttribute('data-tab');
                this.switchTab(tabId);
                
                // Close navbar on mobile
                if (window.innerWidth <= 991) {
                    const navbar = document.getElementById('navbarNav');
                    if (navbar && navbar.classList.contains('show')) {
                        navbar.classList.remove('show');
                    }
                }
            });
        });
    }
    
    // Switch between tabs - CORRECTED
    switchTab(tabId) {
        console.log('Switching to tab:', tabId);
        
        // Remove active class from all nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        // Add active class to clicked nav link
        const clickedLink = document.querySelector(`.nav-link[data-tab="${tabId}"]`);
        if (clickedLink) {
            clickedLink.classList.add('active');
        }
        
        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.style.display = 'none';
            tab.classList.remove('active');
        });
        
        // Show selected tab
        const selectedTab = document.getElementById(tabId);
        if (selectedTab) {
            selectedTab.style.display = 'block';
            selectedTab.classList.add('active');
        }
        
        // Load tab-specific data
        this.loadTabData(tabId);
    }
    
    // Load data for specific tab
    loadTabData(tabId) {
        switch(tabId) {
            case 'ongoing-orders':
                this.renderOngoingOrders();
                break;
            case 'completed-orders':
                this.renderCompletedOrders();
                break;
            case 'menu-management':
                this.renderMenuManagement();
                break;
            case 'analytics':
                this.updateAnalytics();
                break;
            case 'profile':
                this.updateProfileTab();
                break;
            // 'take-order' doesn't need special loading
        }
    }
    
    // Check authentication state
    initAuth() {
        this.auth.onAuthStateChanged((user) => {
            if (user) {
                this.currentUser = user;
                this.updateUserUI();
                this.loadUserData(user.uid);
            } else {
                this.currentUser = null;
                this.userData = null;
                this.businessId = null;
                this.showAuthModal();
            }
        });
    }
    
    // Load user data from Firestore
    async loadUserData(userId) {
        try {
            const userDoc = await this.db.collection('users').doc(userId).get();
            
            if (userDoc.exists) {
                this.userData = userDoc.data();
                
                // Check if user has a business/stall
                if (this.userData.businessId) {
                    this.businessId = this.userData.businessId;
                    await this.loadBusinessData();
                    this.hideAuthModal();
                } else {
                    this.showProfileSetupModal();
                }
            } else {
                // First time user, create user document
                await this.db.collection('users').doc(userId).set({
                    email: this.currentUser.email,
                    displayName: this.currentUser.displayName,
                    photoURL: this.currentUser.photoURL,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                this.showProfileSetupModal();
            }
            
            this.updateUIForLoggedInUser();
        } catch (error) {
            console.error('Error loading user data:', error);
            this.showNotification('Error loading user data', 'error');
        }
    }
    
    // Load business data from Firestore - SIMPLIFIED to avoid index error
    async loadBusinessData() {
        try {
            // Load menu
            const menuSnapshot = await this.db.collection('businesses')
                .doc(this.businessId)
                .collection('menu')
                .get();
            
            if (!menuSnapshot.empty) {
                this.menu = menuSnapshot.docs.map(doc => ({ 
                    id: doc.id, 
                    ...doc.data(),
                    cost: doc.data().cost || 0
                }));
            }
            
            // Load categories
            const businessDoc = await this.db.collection('businesses').doc(this.businessId).get();
            if (businessDoc.exists) {
                const businessData = businessDoc.data();
                this.categories = businessData.categories || this.getDefaultCategories();
                this.nextOrderId = businessData.nextOrderId || 1001;
                this.updateNextOrderNumber();
            }
            
            // Load orders - simplified to avoid composite index error
            const ordersSnapshot = await this.db.collection('businesses')
                .doc(this.businessId)
                .collection('orders')
                .get();
            
            const allOrders = ordersSnapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data(),
                orderNumber: doc.data().orderNumber || 0
            }));
            
            // Filter ongoing orders locally
            this.orders = allOrders
                .filter(order => order.status === 'preparing' || order.status === 'ready')
                .sort((a, b) => new Date(b.orderTime) - new Date(a.orderTime));
            
            // Filter completed orders locally
            this.completedOrders = allOrders
                .filter(order => order.status === 'completed')
                .sort((a, b) => new Date(b.completedTime || b.orderTime) - new Date(a.completedTime || a.orderTime))
                .slice(0, 50);
            
            // Update UI
            this.renderMenu();
            this.renderOngoingOrders();
            this.renderCompletedOrders();
            this.renderMenuManagement();
            this.updateSummary();
            this.updateStats();
            this.updateBadges();
            
        } catch (error) {
            console.error('Error loading business data:', error);
            this.showNotification('Error loading business data: ' + error.message, 'error');
        }
    }
    
    // Google Sign In
    async signInWithGoogle() {
        try {
            const result = await this.auth.signInWithPopup(this.googleProvider);
            this.currentUser = result.user;
            this.showNotification('Signed in successfully!', 'success');
        } catch (error) {
            console.error('Error signing in:', error);
            this.showNotification('Error signing in: ' + error.message, 'error');
        }
    }
    
    // Sign Out
    async signOut() {
        try {
            await this.auth.signOut();
            this.currentUser = null;
            this.userData = null;
            this.businessId = null;
            this.showNotification('Signed out successfully', 'info');
            this.showAuthModal();
        } catch (error) {
            console.error('Error signing out:', error);
            this.showNotification('Error signing out', 'error');
        }
    }
    
    // Initialize event listeners
    initEventListeners() {
        // Customer info
        document.getElementById('customer-name')?.addEventListener('input', (e) => {
            this.currentOrder.customerName = e.target.value;
            this.updateSummary();
        });
        
        document.getElementById('customer-phone')?.addEventListener('input', (e) => {
            this.currentOrder.customerPhone = e.target.value;
        });
        
        document.getElementById('order-type')?.addEventListener('change', (e) => {
            this.currentOrder.orderType = e.target.value;
            this.updateSummary();
        });
        
        document.getElementById('payment-method')?.addEventListener('change', (e) => {
            this.currentOrder.paymentMethod = e.target.value;
            this.updateSummary();
        });
        
        // Menu search
        document.getElementById('menu-search')?.addEventListener('input', (e) => {
            this.renderMenu(e.target.value.toLowerCase());
        });
        
        // Action buttons
        document.getElementById('clear-order-btn')?.addEventListener('click', () => this.clearCurrentOrder());
        document.getElementById('place-order-btn')?.addEventListener('click', () => this.placeOrder());
        
        // Quick action buttons
        document.getElementById('quick-drinks')?.addEventListener('click', () => this.showCategory('DRINKS'));
        document.getElementById('quick-desserts')?.addEventListener('click', () => this.showCategory('DESSERTS'));
        document.getElementById('quick-appetizers')?.addEventListener('click', () => this.showCategory('APPETIZERS'));
        document.getElementById('quick-wraps')?.addEventListener('click', () => this.showCategory('WRAPS'));
        
        // Refresh orders
        document.getElementById('refresh-orders-btn')?.addEventListener('click', () => this.renderOngoingOrders());
        
        // Print all
        document.getElementById('print-all-btn')?.addEventListener('click', () => this.printAllOrders());
        
        // Download PDF
        document.getElementById('download-pdf-btn')?.addEventListener('click', () => this.downloadPDFReport());
        
        // Clear completed
        document.getElementById('clear-completed-btn')?.addEventListener('click', () => this.clearCompletedOrders());
        
        // Date filter
        document.getElementById('date-filter')?.addEventListener('change', () => this.renderCompletedOrders());
        
        // Analytics period filter
        document.getElementById('analytics-period')?.addEventListener('change', () => this.updateAnalytics());
        
        // Menu management
        document.getElementById('menu-item-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveMenuItem();
        });
        
        document.getElementById('cancel-edit-btn')?.addEventListener('click', () => this.cancelEditMenuItem());
        document.getElementById('add-category-btn')?.addEventListener('click', () => this.showNewCategoryInput());
        document.getElementById('new-category-btn')?.addEventListener('click', () => this.showNewCategoryInput());
        document.getElementById('save-category-btn')?.addEventListener('click', () => this.saveNewCategory());
        document.getElementById('cancel-category-btn')?.addEventListener('click', () => this.hideNewCategoryInput());
        
        // Complete order in modal
        document.getElementById('complete-order-btn')?.addEventListener('click', () => {
            const orderId = document.getElementById('complete-order-btn').getAttribute('data-order-id');
            this.completeOrder(orderId);
        });
        
        // Auth and profile buttons
        document.getElementById('google-signin-btn')?.addEventListener('click', () => this.signInWithGoogle());
        document.getElementById('save-initial-profile-btn')?.addEventListener('click', () => this.saveInitialProfile());
        document.getElementById('logout-btn')?.addEventListener('click', () => this.signOut());
        
        // Business profile form
        document.getElementById('business-profile-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleBusinessProfileSubmit();
        });
    }
    
    // Rest of the methods remain the same as in the previous version...
    // Only showing the critical methods for tab switching and auth
    // All other methods (renderMenu, updateSummary, etc.) should be copied from the previous version
    
    // Show authentication modal
    showAuthModal() {
        // Create modal if it doesn't exist
        if (!document.getElementById('authModal')) {
            const modalHTML = `
                <div class="modal fade" id="authModal" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content">
                            <div class="modal-header border-0">
                                <h5 class="modal-title">Welcome to Restaurant POS</h5>
                            </div>
                            <div class="modal-body text-center">
                                <div class="mb-4">
                                    <i class="fas fa-utensils fa-4x text-primary mb-3"></i>
                                    <h3>Restaurant Order System</h3>
                                    <p class="text-muted">Please sign in to manage your restaurant</p>
                                </div>
                                
                                <button class="btn btn-lg btn-primary w-100 mb-3" id="google-signin-btn">
                                    <i class="fab fa-google me-2"></i> Sign in with Google
                                </button>
                                
                                <div class="text-muted small mt-3">
                                    <p>By signing in, you agree to our Terms of Service and Privacy Policy</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            
            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('authModal'));
            modal.show();
            
            // Add event listener
            document.getElementById('google-signin-btn').addEventListener('click', () => {
                this.signInWithGoogle();
            });
        } else {
            // Show existing modal
            const modal = new bootstrap.Modal(document.getElementById('authModal'));
            modal.show();
        }
    }
    
    // Hide authentication modal
    hideAuthModal() {
        const modal = bootstrap.Modal.getInstance(document.getElementById('authModal'));
        if (modal) {
            modal.hide();
        }
    }
    
    // Show profile setup modal
    showProfileSetupModal() {
        // Create modal if it doesn't exist
        if (!document.getElementById('profileSetupModal')) {
            const modalHTML = `
                <div class="modal fade" id="profileSetupModal" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Setup Your Business</h5>
                            </div>
                            <div class="modal-body">
                                <p>Welcome! Please setup your business profile to get started.</p>
                                
                                <form id="initial-profile-form">
                                    <div class="mb-3">
                                        <label class="form-label">Business Name *</label>
                                        <input type="text" class="form-control" id="initial-business-name" required>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">Business Type</label>
                                        <select class="form-select" id="initial-business-type">
                                            <option value="restaurant">Restaurant</option>
                                            <option value="cafe">Cafe</option>
                                            <option value="food-truck">Food Truck</option>
                                            <option value="catering">Catering Service</option>
                                            <option value="event">Event Stall</option>
                                        </select>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">Contact Phone</label>
                                        <input type="tel" class="form-control" id="initial-business-phone">
                                    </div>
                                </form>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-primary" id="save-initial-profile-btn">
                                    Save & Continue
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            
            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('profileSetupModal'));
            modal.show();
            
            // Add event listener
            document.getElementById('save-initial-profile-btn').addEventListener('click', () => {
                this.saveInitialProfile();
            });
        } else {
            // Show existing modal
            const modal = new bootstrap.Modal(document.getElementById('profileSetupModal'));
            modal.show();
        }
    }
    
    // Update UI for logged in user
    updateUIForLoggedInUser() {
        const profileLink = document.getElementById('profile-nav-link');
        if (profileLink && this.currentUser) {
            const userName = this.currentUser.displayName || this.currentUser.email;
            const navText = profileLink.querySelector('.nav-text');
            if (navText) navText.textContent = userName.split('@')[0];
        }
        
        // Show/hide tabs based on authentication
        const tabs = document.querySelectorAll('.tab-content');
        tabs.forEach(tab => {
            if (tab.id !== 'profile') {
                tab.style.display = this.currentUser ? 'block' : 'none';
            }
        });
    }
    
    // Update user UI elements
    updateUserUI() {
        // Update user avatar and name in profile tab
        const userAvatar = document.getElementById('user-avatar');
        const userDisplayName = document.getElementById('user-display-name');
        const userEmail = document.getElementById('user-email');
        
        if (userAvatar && this.currentUser.photoURL) {
            userAvatar.src = this.currentUser.photoURL;
            userAvatar.style.display = 'block';
        }
        
        if (userDisplayName) {
            userDisplayName.textContent = this.currentUser.displayName || this.currentUser.email.split('@')[0];
        }
        
        if (userEmail) {
            userEmail.textContent = this.currentUser.email;
        }
    }
    
    // Show notification
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        notification.style.cssText = `
            top: 80px;
            right: 20px;
            z-index: 9999;
            min-width: 300px;
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }
    
    // IMPORTANT: Add all the other methods from the previous version here
    // This includes: renderMenu, updateSummary, updateStats, updateBadges, etc.
    // Since the code is very long, I'll show a few critical ones and you should copy the rest
    
    // Render menu items
    renderMenu(searchTerm = '') {
        const container = document.getElementById('menu-items-container');
        if (!container) return;
        
        container.innerHTML = '';
        
        // Group items by category
        const categories = {};
        this.menu.forEach(item => {
            if (!categories[item.category]) {
                categories[item.category] = [];
            }
            categories[item.category].push(item);
        });
        
        // Create category sections
        this.categories.forEach(categoryName => {
            const items = categories[categoryName] || [];
            
            // Filter by search term
            const filteredItems = items.filter(item => 
                searchTerm === '' || 
                item.name.toLowerCase().includes(searchTerm) ||
                item.category.toLowerCase().includes(searchTerm)
            );
            
            if (filteredItems.length === 0 && searchTerm !== '') return;
            
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'menu-category';
            categoryDiv.innerHTML = `
                <h6>${categoryName}</h6>
                <div class="row" id="category-${categoryName.replace(/\s+/g, '-')}"></div>
            `;
            
            const itemsContainer = categoryDiv.querySelector(`#category-${categoryName.replace(/\s+/g, '-')}`);
            
            filteredItems.forEach(item => {
                const colSize = window.innerWidth <= 576 ? 'col-6' : 'col-md-4 col-lg-3';
                const itemDiv = document.createElement('div');
                itemDiv.className = `${colSize}`;
                
                // Check if item is in current order
                const currentItem = this.currentOrder.items.find(i => i.id === item.id);
                const quantity = currentItem ? currentItem.quantity : 0;
                const isSelected = quantity > 0;
                
                itemDiv.innerHTML = `
                    <div class="menu-item-card ${isSelected ? 'selected' : ''}" 
                         data-item-id="${item.id}">
                        <div>
                            <div class="menu-item-name">${item.name}</div>
                            <div class="menu-item-price">₹${item.price}</div>
                        </div>
                        <div class="menu-item-quantity">
                            <button class="quantity-btn minus-btn" data-item-id="${item.id}">
                                <i class="fas fa-minus"></i>
                            </button>
                            <input type="number" class="quantity-input" id="qty-${item.id}" 
                                   value="${quantity}" min="0" data-item-id="${item.id}">
                            <button class="quantity-btn plus-btn" data-item-id="${item.id}">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                    </div>
                `;
                
                itemsContainer.appendChild(itemDiv);
                
                // Add event listeners
                const minusBtn = itemDiv.querySelector('.minus-btn');
                const plusBtn = itemDiv.querySelector('.plus-btn');
                const qtyInput = itemDiv.querySelector('.quantity-input');
                
                minusBtn.addEventListener('click', () => this.adjustQuantity(item.id, -1));
                plusBtn.addEventListener('click', () => this.adjustQuantity(item.id, 1));
                qtyInput.addEventListener('change', (e) => this.setQuantity(item.id, parseInt(e.target.value) || 0));
                qtyInput.addEventListener('input', (e) => this.setQuantity(item.id, parseInt(e.target.value) || 0));
            });
            
            container.appendChild(categoryDiv);
        });
    }
    
    // Adjust item quantity
    adjustQuantity(itemId, change) {
        const input = document.getElementById(`qty-${itemId}`);
        if (!input) return;
        
        let currentValue = parseInt(input.value) || 0;
        let newValue = currentValue + change;
        
        if (newValue < 0) newValue = 0;
        
        input.value = newValue;
        this.setQuantity(itemId, newValue);
    }
    
    // Set item quantity
    setQuantity(itemId, quantity) {
        // Find the item in current order
        const existingItemIndex = this.currentOrder.items.findIndex(item => item.id === itemId);
        
        if (quantity > 0) {
            const menuItem = this.menu.find(item => item.id === itemId);
            
            if (existingItemIndex >= 0) {
                // Update existing item
                this.currentOrder.items[existingItemIndex].quantity = quantity;
                this.currentOrder.items[existingItemIndex].total = quantity * menuItem.price;
                this.currentOrder.items[existingItemIndex].totalCost = quantity * menuItem.cost;
                this.currentOrder.items[existingItemIndex].profit = quantity * (menuItem.price - menuItem.cost);
            } else {
                // Add new item
                this.currentOrder.items.push({
                    id: itemId,
                    name: menuItem.name,
                    price: menuItem.price,
                    cost: menuItem.cost,
                    quantity: quantity,
                    total: quantity * menuItem.price,
                    totalCost: quantity * menuItem.cost,
                    profit: quantity * (menuItem.price - menuItem.cost)
                });
            }
        } else if (existingItemIndex >= 0) {
            // Remove item if quantity is 0
            this.currentOrder.items.splice(existingItemIndex, 1);
        }
        
        // Update UI
        this.updateSelectedItemsTable();
        this.updateSummary();
        
        // Update menu item card
        const menuCard = document.querySelector(`.menu-item-card[data-item-id="${itemId}"]`);
        const qtyInput = document.getElementById(`qty-${itemId}`);
        
        if (menuCard && qtyInput) {
            if (quantity > 0) {
                menuCard.classList.add('selected');
                qtyInput.value = quantity;
            } else {
                menuCard.classList.remove('selected');
                qtyInput.value = 0;
            }
        }
    }
    
    // Update selected items table
    updateSelectedItemsTable() {
        const tbody = document.getElementById('selected-items-body');
        
        if (this.currentOrder.items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-muted py-4">
                        No items selected
                    </td>
                </tr>
            `;
            
            document.getElementById('grand-total').textContent = '₹0';
            
            return;
        }
        
        let html = '';
        let total = 0;
        
        this.currentOrder.items.forEach((item) => {
            total += item.total;
            
            html += `
                <tr>
                    <td>${item.name}</td>
                    <td>
                        <div class="input-group input-group-sm" style="width: 100px;">
                            <button class="btn btn-outline-secondary" type="button" 
                                    onclick="restaurantSystem.adjustQuantity('${item.id}', -1)">-</button>
                            <input type="number" class="form-control text-center" 
                                   value="${item.quantity}" min="1" 
                                   onchange="restaurantSystem.setQuantity('${item.id}', this.value)">
                            <button class="btn btn-outline-secondary" type="button" 
                                    onclick="restaurantSystem.adjustQuantity('${item.id}', 1)">+</button>
                        </div>
                    </td>
                    <td>₹${item.price}</td>
                    <td>₹${item.total}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-danger" 
                                onclick="restaurantSystem.setQuantity('${item.id}', 0)">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
        
        document.getElementById('grand-total').textContent = `₹${total}`;
    }
    
    // Update order summary
    updateSummary() {
        // Update customer info
        const summaryCustomer = document.getElementById('summary-customer');
        if (summaryCustomer) {
            summaryCustomer.textContent = this.currentOrder.customerName || 'Not specified';
        }
        
        // Update order type
        const typeMap = {
            'dine-in': 'Dine In',
            'takeaway': 'Takeaway',
            'delivery': 'Delivery'
        };
        const summaryType = document.getElementById('summary-type');
        if (summaryType) {
            summaryType.textContent = typeMap[this.currentOrder.orderType] || 'Dine In';
        }
        
        // Update payment method
        const paymentMap = {
            'cash': 'Cash',
            'card': 'Card',
            'upi': 'UPI'
        };
        const summaryPayment = document.getElementById('summary-payment');
        if (summaryPayment) {
            summaryPayment.textContent = paymentMap[this.currentOrder.paymentMethod] || 'Cash';
        }
        
        // Update items in summary
        const container = document.getElementById('summary-items');
        if (!container) return;
        
        let html = '';
        let total = 0;
        
        this.currentOrder.items.forEach(item => {
            total += item.total;
            
            html += `
                <div class="summary-item">
                    <span>${item.name} x${item.quantity}</span>
                    <span>₹${item.total}</span>
                </div>
            `;
        });
        
        container.innerHTML = html || '<div class="text-muted small">No items selected</div>';
        
        // Update total
        const summaryTotal = document.getElementById('summary-total');
        if (summaryTotal) {
            summaryTotal.textContent = `₹${total}`;
        }
    }
    
    // For the complete solution, you need to copy ALL the remaining methods from the previous version
    // This includes: updateStats, updateBadges, updateNextOrderNumber, placeOrder, clearCurrentOrder, 
    // renderOngoingOrders, renderCompletedOrders, and all other methods
}

// Initialize the system when page loads
let restaurantSystem;

document.addEventListener('DOMContentLoaded', () => {
    restaurantSystem = new RestaurantOrderSystem();
    
    // Make system globally available for inline event handlers
    window.restaurantSystem = restaurantSystem;
    
    // Check online/offline status
    window.addEventListener('online', () => {
        restaurantSystem.syncLocalDataWithFirestore();
    });
    
    // Handle back button/forward button
    window.addEventListener('popstate', () => {
        // Handle tab switching based on URL hash if needed
    });
    
    // Prevent form submission on enter
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
        }
    });
});