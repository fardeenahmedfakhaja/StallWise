// Restaurant Order Management System with Firebase - FIXED VERSION
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
        this.businessData = null;
        
        // Initialize data from local storage as fallback
        this.menu = this.loadData('menu') || [];
        this.categories = this.loadData('categories') || [];
        this.orders = this.loadData('orders') || [];
        this.completedOrders = this.loadData('completedOrders') || [];
        this.nextOrderId = this.loadData('nextOrderId') || 1001;
        
        // Loading states
        this.loadingQueue = 0;
        this.authChecked = false;
        
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
    
    // ================= INITIALIZATION =================
    
    init() {
        // Show loading screen immediately
        this.showLoading('Checking authentication...');
        
        // Initialize event listeners
        this.initEventListeners();
        this.setupLongPressEvents();
        
        // Check auth state
        this.initAuth();
    }
    
    // Local storage methods
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
    
    // ================= AUTHENTICATION & LOGIN SCREEN =================
    
    initAuth() {
        // Listen for auth state changes
        this.auth.onAuthStateChanged(async (user) => {
            if (user) {
                // User is signed in
                this.currentUser = user;
                await this.loadUserData(user.uid);
                this.showApp();
            } else {
                // User is signed out
                this.showLoginScreen();
            }
            this.authChecked = true;
            this.hideLoading();
        });
    }
    
    showLoginScreen() {
        const loginScreen = document.getElementById('login-screen');
        const appContent = document.getElementById('app-content');
        
        if (loginScreen) {
            loginScreen.style.display = 'flex';
        }
        if (appContent) {
            appContent.style.display = 'none';
        }
        
        // Clear any existing modal backdrops
        this.cleanupModalBackdrops();
    }
    
    showApp() {
        const loginScreen = document.getElementById('login-screen');
        const appContent = document.getElementById('app-content');
        
        if (loginScreen) {
            loginScreen.style.display = 'none';
        }
        if (appContent) {
            appContent.style.display = 'block';
        }
        
        // Setup app
        this.setupTabNavigation();
        this.updateUserUI();
        this.updateUIForLoggedInUser();
        this.renderMenu();
        this.updateSummary();
        this.updateStats();
        this.updateBadges();
        this.updateNextOrderNumber();
        
        // Add global reference
        window.restaurantSystem = this;
    }
    
    async loadUserData(userId) {
        try {
            const userDoc = await this.db.collection('users').doc(userId).get();
            
            if (userDoc.exists) {
                this.userData = userDoc.data();
                
                if (this.userData.businessId) {
                    this.businessId = this.userData.businessId;
                    await this.loadBusinessData();
                } else {
                    this.showProfileSetupModal();
                }
            } else {
                await this.db.collection('users').doc(userId).set({
                    email: this.currentUser.email,
                    displayName: this.currentUser.displayName,
                    photoURL: this.currentUser.photoURL,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                this.showProfileSetupModal();
            }
        } catch (error) {
            console.error('Error loading user data:', error);
            this.showNotification('Error loading user data', 'error');
        }
    }
    
    async signInWithGoogle() {
        const button = document.getElementById('google-signin-btn');
        await this.withLoading(async () => {
            try {
                await this.auth.signInWithPopup(this.googleProvider);
                this.showNotification('Signed in successfully!', 'success');
            } catch (error) {
                console.error('Error signing in:', error);
                this.showNotification('Error signing in: ' + error.message, 'error');
            }
        }, 'Signing in...', button);
    }
    
    async signOut() {
        const button = document.getElementById('logout-btn');
        await this.withLoading(async () => {
            try {
                await this.auth.signOut();
                this.currentUser = null;
                this.userData = null;
                this.businessId = null;
                this.businessData = null;
                
                // Clear local data
                localStorage.clear();
                
                // Show login screen
                this.showLoginScreen();
                
                this.showNotification('Signed out successfully', 'info');
            } catch (error) {
                console.error('Error signing out:', error);
                this.showNotification('Error signing out', 'error');
            }
        }, 'Signing out...', button);
    }
    
    // ================= ENHANCED MENU RENDERING =================
    
    renderMenu(searchTerm = '') {
        const container = document.getElementById('menu-items-container');
        if (!container) return;
        
        container.innerHTML = '';
        
        // Filter out out-of-stock items
        const availableItems = this.menu.filter(item => !item.outOfStock);
        
        if (availableItems.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center py-5">
                    <i class="fas fa-utensils fa-3x text-muted mb-3"></i>
                    <h5 class="text-muted">No Menu Items Available</h5>
                    <p class="text-muted">Add items in the Menu Management tab</p>
                </div>
            `;
            return;
        }
        
        // Group by category
        const categories = {};
        availableItems.forEach(item => {
            if (!categories[item.category]) {
                categories[item.category] = [];
            }
            categories[item.category].push(item);
        });
        
        // Create category sections
        this.categories.forEach(category => {
            const categoryName = category.name || category;
            const items = categories[categoryName] || [];
            
            // Filter by search term
            const filteredItems = items.filter(item => 
                searchTerm === '' || 
                item.name.toLowerCase().includes(searchTerm) ||
                categoryName.toLowerCase().includes(searchTerm)
            );
            
            if (filteredItems.length === 0 && searchTerm !== '') return;
            
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'menu-category';
            categoryDiv.id = `category-${categoryName.replace(/\s+/g, '-')}`;
            categoryDiv.innerHTML = `
                <h6 class="category-title">${categoryName}</h6>
                <div class="row g-2" id="items-${categoryName.replace(/\s+/g, '-')}"></div>
            `;
            
            const itemsContainer = categoryDiv.querySelector(`#items-${categoryName.replace(/\s+/g, '-')}`);
            
            filteredItems.forEach(item => {
                // FIXED: Better responsive columns
                const colSize = window.innerWidth < 768 ? 'col-6' : 
                               window.innerWidth < 992 ? 'col-md-4' : 'col-lg-3';
                
                const itemDiv = document.createElement('div');
                itemDiv.className = `${colSize}`;
                
                // Check if item is in current order
                const currentItem = this.currentOrder.items.find(i => i.id === item.id);
                const quantity = currentItem ? currentItem.quantity : 0;
                const isSelected = quantity > 0;
                
                itemDiv.innerHTML = `
                    <div class="menu-item-card ${isSelected ? 'selected' : ''}" 
                         data-item-id="${item.id}">
                        <div class="menu-item-content">
                            <div class="menu-item-header">
                                <div class="menu-item-name">${item.name}</div>
                                <div class="menu-item-price">₹${item.price}</div>
                            </div>
                            ${item.tax > 0 ? `<div class="menu-item-tax">+${item.tax}% tax</div>` : ''}
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
        
        // Update mobile selected items view
        this.updateMobileSelectedItems();
        
        // Update mobile category filter
        this.updateMobileCategoryFilter();
    }
    
    updateMobileSelectedItems() {
        const mobileContainer = document.getElementById('mobile-selected-items');
        if (!mobileContainer || window.innerWidth > 768) return;
        
        if (this.currentOrder.items.length === 0) {
            mobileContainer.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-shopping-cart fa-2x mb-2"></i>
                    <p>No items selected</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        this.currentOrder.items.forEach(item => {
            html += `
                <div class="selected-item-card">
                    <div class="selected-item-info">
                        <div class="selected-item-name">${item.name}</div>
                        <div class="selected-item-details">
                            ₹${item.price} each | Tax: ${item.tax}%
                        </div>
                    </div>
                    <div class="selected-item-actions">
                        <div class="selected-item-quantity">
                            <button class="selected-item-qty-btn" onclick="restaurantSystem.adjustQuantity('${item.id}', -1)">-</button>
                            <input type="number" class="selected-item-qty-input" 
                                   value="${item.quantity}" 
                                   onchange="restaurantSystem.setQuantity('${item.id}', this.value)">
                            <button class="selected-item-qty-btn" onclick="restaurantSystem.adjustQuantity('${item.id}', 1)">+</button>
                        </div>
                        <button class="selected-item-remove" onclick="restaurantSystem.setQuantity('${item.id}', 0)">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        mobileContainer.innerHTML = html;
    }
    
    updateMobileCategoryFilter() {
        const filterContainer = document.querySelector('.scrollable-categories');
        if (!filterContainer || window.innerWidth > 768) return;
        
        let html = '<button class="category-filter-btn active" data-category="all">All</button>';
        
        this.categories.forEach(category => {
            const categoryName = category.name || category;
            html += `<button class="category-filter-btn" data-category="${categoryName}">${categoryName}</button>`;
        });
        
        filterContainer.innerHTML = html;
        
        // Add event listeners
        filterContainer.querySelectorAll('.category-filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const category = e.currentTarget.getAttribute('data-category');
                
                // Update active button
                filterContainer.querySelectorAll('.category-filter-btn').forEach(b => {
                    b.classList.remove('active');
                });
                e.currentTarget.classList.add('active');
                
                // Scroll to category or show all
                if (category === 'all') {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                    const element = document.getElementById(`category-${category.replace(/\s+/g, '-')}`);
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
            });
        });
    }
    
    // ================= UTILITY METHODS =================
    
    setupTabNavigation() {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const tabId = link.getAttribute('data-tab');
                this.switchTab(tabId);
                
                // Close navbar on mobile
                if (window.innerWidth <= 991) {
                    const navbar = document.getElementById('navbarNav');
                    if (navbar && navbar.classList.contains('show')) {
                        const bsCollapse = new bootstrap.Collapse(navbar, { toggle: false });
                        bsCollapse.hide();
                    }
                }
            });
        });
        
        this.switchTab('take-order');
    }
    
    switchTab(tabId) {
        // Update nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        const clickedLink = document.querySelector(`.nav-link[data-tab="${tabId}"]`);
        if (clickedLink) clickedLink.classList.add('active');
        
        // Update tab contents
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.style.display = 'none';
            tab.classList.remove('active');
        });
        
        const selectedTab = document.getElementById(tabId);
        if (selectedTab) {
            selectedTab.style.display = 'block';
            selectedTab.classList.add('active');
            
            // Scroll to top on mobile
            if (window.innerWidth <= 768) {
                window.scrollTo(0, 0);
            }
        }
        
        // Load tab data
        this.loadTabData(tabId);
    }
    
    loadTabData(tabId) {
        switch(tabId) {
            case 'take-order':
                this.updateQuickActions();
                break;
            case 'ongoing-orders':
                this.renderOngoingOrders();
                break;
            case 'completed-orders':
                this.setupDateFilters();
                this.renderCompletedOrders();
                break;
            case 'menu-management':
                this.renderMenuManagement();
                this.loadCategoriesDropdown();
                break;
            case 'analytics':
                this.setupDateFilters();
                this.updateAnalytics();
                break;
            case 'profile':
                this.updateProfileTab();
                break;
        }
    }
    
    setupLongPressEvents() {
        const profileLink = document.getElementById('profile-nav-link');
        let pressTimer;
        
        if (profileLink) {
            profileLink.addEventListener('touchstart', (e) => {
                pressTimer = setTimeout(() => {
                    this.showQRCode();
                    e.preventDefault();
                }, 1000);
            });
            
            profileLink.addEventListener('touchend', () => {
                clearTimeout(pressTimer);
            });
        }
        
        // QR code image click
        document.getElementById('profile-qr-code')?.addEventListener('click', () => {
            this.showQRCode();
        });
    }
    
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
        
        const placeOrderBtn = document.getElementById('place-order-btn');
        placeOrderBtn?.addEventListener('click', () => this.placeOrder(placeOrderBtn));
        
        // Google sign in
        document.getElementById('google-signin-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.signInWithGoogle();
        });
        
        // Logout
        document.getElementById('logout-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.signOut();
        });
        
        // Refresh orders
        const refreshOrdersBtn = document.getElementById('refresh-orders-btn');
        refreshOrdersBtn?.addEventListener('click', () => this.loadBusinessData());
        
        // Print all
        document.getElementById('print-all-btn')?.addEventListener('click', () => this.printAllOrders());
        
        // Download PDF
        const downloadPdfBtn = document.getElementById('download-pdf-btn');
        downloadPdfBtn?.addEventListener('click', () => this.downloadPDFReport(downloadPdfBtn));
        
        // Clear completed
        const clearCompletedBtn = document.getElementById('clear-completed-btn');
        clearCompletedBtn?.addEventListener('click', () => this.clearCompletedOrders(clearCompletedBtn));
        
        // Date filter for completed orders
        document.getElementById('apply-date-filter')?.addEventListener('click', () => {
            this.renderCompletedOrders();
        });
        
        // Date filter for analytics
        document.getElementById('apply-analytics-filter')?.addEventListener('click', () => {
            this.updateAnalytics();
        });
        
        // Menu management
        const menuItemForm = document.getElementById('menu-item-form');
        const saveMenuItemBtn = menuItemForm?.querySelector('button[type="submit"]');
        menuItemForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveMenuItem(saveMenuItemBtn);
        });
        
        document.getElementById('cancel-edit-btn')?.addEventListener('click', () => this.cancelEditMenuItem());
        document.getElementById('add-category-btn')?.addEventListener('click', () => this.showNewCategoryInput());
        
        const newCategoryBtn = document.getElementById('new-category-btn');
        newCategoryBtn?.addEventListener('click', () => this.showNewCategoryInput());
        
        const saveCategoryBtn = document.getElementById('save-category-btn');
        saveCategoryBtn?.addEventListener('click', () => this.saveNewCategory(saveCategoryBtn));
        
        document.getElementById('cancel-category-btn')?.addEventListener('click', () => this.hideNewCategoryInput());
        
        // Complete order in modal
        const completeOrderBtn = document.getElementById('complete-order-btn');
        completeOrderBtn?.addEventListener('click', (e) => {
            const orderId = e.currentTarget.getAttribute('data-order-id');
            this.completeOrder(orderId, completeOrderBtn);
        });
        
        // Profile setup
        document.getElementById('save-initial-profile-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.saveInitialProfile(e.target);
        });
        
        // Business profile form
        const businessProfileForm = document.getElementById('business-profile-form');
        const saveProfileBtn = businessProfileForm?.querySelector('button[type="submit"]');
        businessProfileForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleBusinessProfileSubmit(saveProfileBtn);
        });
        
        // Preview logo and QR code
        document.getElementById('business-logo')?.addEventListener('change', (e) => {
            this.previewImage(e.target, 'logo-preview');
        });
        
        document.getElementById('qr-code')?.addEventListener('change', (e) => {
            this.previewImage(e.target, 'qr-code-preview');
        });
        
        // Fix QR Code modal
        const qrModal = document.getElementById('qrCodeModal');
        if (qrModal) {
            qrModal.addEventListener('hidden.bs.modal', () => {
                this.cleanupModalBackdrops();
            });
        }
        
        // Fix other modals
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.addEventListener('hidden.bs.modal', () => {
                this.cleanupModalBackdrops();
            });
        });
        
        // Window resize for responsive updates
        window.addEventListener('resize', () => {
            if (window.innerWidth <= 768) {
                this.updateMobileSelectedItems();
                this.updateMobileCategoryFilter();
            }
            this.renderMenu();
        });
    }
    
    // ================= LOADING & NOTIFICATION =================
    
    showLoading(message = 'Processing...') {
        this.loadingQueue++;
        const overlay = document.getElementById('loading-overlay');
        const loadingText = overlay?.querySelector('.loading-text');
        
        if (overlay && loadingText) {
            loadingText.textContent = message;
            overlay.classList.add('show');
        }
    }
    
    hideLoading() {
        this.loadingQueue = Math.max(0, this.loadingQueue - 1);
        
        if (this.loadingQueue === 0) {
            const overlay = document.getElementById('loading-overlay');
            if (overlay) overlay.classList.remove('show');
        }
    }
    
    setButtonLoading(button, isLoading) {
        if (isLoading) {
            button.classList.add('btn-loading');
            button.disabled = true;
        } else {
            button.classList.remove('btn-loading');
            button.disabled = false;
        }
    }
    
    async withLoading(operation, loadingMessage = 'Processing...', button = null) {
        try {
            this.showLoading(loadingMessage);
            if (button) this.setButtonLoading(button, true);
            
            return await operation();
        } catch (error) {
            console.error('Operation failed:', error);
            this.showNotification('Error: ' + error.message, 'error');
            throw error;
        } finally {
            this.hideLoading();
            if (button) this.setButtonLoading(button, false);
        }
    }
    
    showNotification(message, type = 'info') {
        // Remove any existing notifications first
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => notification.remove());
        
        const notification = document.createElement('div');
        notification.className = `notification alert alert-${type} alert-dismissible fade show`;
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 9999;
            min-width: 300px;
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) notification.remove();
        }, 5000);
    }
    
    // ================= ORDER MANAGEMENT =================
    
    adjustQuantity(itemId, change) {
        const input = document.getElementById(`qty-${itemId}`);
        if (!input) return;
        
        let currentValue = parseInt(input.value) || 0;
        let newValue = currentValue + change;
        
        if (newValue < 0) newValue = 0;
        
        input.value = newValue;
        this.setQuantity(itemId, newValue);
    }
    
    setQuantity(itemId, quantity) {
        const existingItemIndex = this.currentOrder.items.findIndex(item => item.id === itemId);
        const menuItem = this.menu.find(item => item.id === itemId);
        
        if (!menuItem) return;
        
        if (quantity > 0) {
            const price = menuItem.price;
            const taxRate = menuItem.tax || 0;
            const taxAmount = (price * quantity * taxRate) / 100;
            const subtotal = price * quantity;
            const total = subtotal + taxAmount;
            
            if (existingItemIndex >= 0) {
                this.currentOrder.items[existingItemIndex] = {
                    ...this.currentOrder.items[existingItemIndex],
                    quantity: quantity,
                    price: price,
                    cost: menuItem.cost,
                    tax: taxRate,
                    taxAmount: taxAmount,
                    subtotal: subtotal,
                    total: total,
                    totalCost: quantity * menuItem.cost,
                    profit: total - (quantity * menuItem.cost)
                };
            } else {
                this.currentOrder.items.push({
                    id: itemId,
                    name: menuItem.name,
                    price: price,
                    cost: menuItem.cost,
                    quantity: quantity,
                    tax: taxRate,
                    taxAmount: taxAmount,
                    subtotal: subtotal,
                    total: total,
                    totalCost: quantity * menuItem.cost,
                    profit: total - (quantity * menuItem.cost)
                });
            }
        } else if (existingItemIndex >= 0) {
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
        
        // Update mobile view
        if (window.innerWidth <= 768) {
            this.updateMobileSelectedItems();
        }
    }
    
    updateSelectedItemsTable() {
        const tbody = document.getElementById('selected-items-body');
        if (!tbody) return;
        
        // Remove existing tfoot
        const table = document.getElementById('selected-items-table');
        let tfoot = table.querySelector('tfoot');
        if (tfoot) {
            tfoot.remove();
        }
        
        if (this.currentOrder.items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted py-4">
                        No items selected
                    </td>
                </tr>
            `;
            return;
        }
        
        let html = '';
        let subtotal = 0;
        let totalTax = 0;
        let total = 0;
        
        this.currentOrder.items.forEach((item) => {
            subtotal += item.subtotal;
            totalTax += item.taxAmount;
            total += item.total;
            
            html += `
                <tr>
                    <td>${item.name}${item.tax > 0 ? `<br><small class="text-muted">${item.tax}% tax</small>` : ''}</td>
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
                    <td>₹${item.subtotal.toFixed(2)}</td>
                    <td>₹${item.taxAmount.toFixed(2)}</td>
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
        
        // Create new footer with totals
        tfoot = document.createElement('tfoot');
        table.appendChild(tfoot);
        
        tfoot.innerHTML = `
            <tr class="table-light">
                <td colspan="3" class="text-end"><strong>Subtotal:</strong></td>
                <td><strong>₹${subtotal.toFixed(2)}</strong></td>
                <td colspan="2"></td>
            </tr>
            <tr class="table-light">
                <td colspan="3" class="text-end"><strong>Total Tax:</strong></td>
                <td></td>
                <td><strong>₹${totalTax.toFixed(2)}</strong></td>
                <td></td>
            </tr>
            <tr class="table-success">
                <td colspan="3" class="text-end"><strong>Grand Total:</strong></td>
                <td colspan="2"><strong>₹${total.toFixed(2)}</strong></td>
                <td></td>
            </tr>
        `;
    }
    
    updateSummary() {
        const summaryCustomer = document.getElementById('summary-customer');
        if (summaryCustomer) {
            summaryCustomer.textContent = this.currentOrder.customerName || 'Not specified';
        }
        
        const typeMap = {
            'dine-in': 'Dine In',
            'takeaway': 'Takeaway',
            'delivery': 'Delivery'
        };
        const summaryType = document.getElementById('summary-type');
        if (summaryType) {
            summaryType.textContent = typeMap[this.currentOrder.orderType] || 'Dine In';
        }
        
        const paymentMap = {
            'cash': 'Cash',
            'card': 'Card',
            'upi': 'UPI'
        };
        const summaryPayment = document.getElementById('summary-payment');
        if (summaryPayment) {
            summaryPayment.textContent = paymentMap[this.currentOrder.paymentMethod] || 'Cash';
        }
        
        const container = document.getElementById('summary-items');
        if (!container) return;
        
        let html = '';
        let subtotal = 0;
        let totalTax = 0;
        let total = 0;
        
        this.currentOrder.items.forEach(item => {
            subtotal += item.subtotal;
            totalTax += item.taxAmount;
            total += item.total;
            
            html += `
                <div class="summary-item">
                    <span>${item.name} x${item.quantity}</span>
                    <span>₹${item.total.toFixed(2)}</span>
                </div>
            `;
        });
        
        container.innerHTML = html || '<div class="text-muted small">No items selected</div>';
        
        const summaryTotal = document.getElementById('summary-total');
        if (summaryTotal) {
            if (this.currentOrder.items.length === 0) {
                summaryTotal.innerHTML = `
                    <div class="d-flex justify-content-between mb-1">
                        <span>Subtotal:</span>
                        <span>₹0.00</span>
                    </div>
                    <div class="d-flex justify-content-between mb-1">
                        <span>Tax:</span>
                        <span>₹0.00</span>
                    </div>
                    <div class="d-flex justify-content-between mt-2 total-row">
                        <strong>Total:</strong>
                        <strong>₹0.00</strong>
                    </div>
                `;
            } else {
                summaryTotal.innerHTML = `
                    <div class="d-flex justify-content-between mb-1">
                        <span>Subtotal:</span>
                        <span>₹${subtotal.toFixed(2)}</span>
                    </div>
                    <div class="d-flex justify-content-between mb-1">
                        <span>Tax:</span>
                        <span>₹${totalTax.toFixed(2)}</span>
                    </div>
                    <div class="d-flex justify-content-between mt-2 total-row">
                        <strong>Total:</strong>
                        <strong>₹${total.toFixed(2)}</strong>
                    </div>
                `;
            }
        }
    }
    
    updateStats() {
        const today = new Date().toISOString().split('T')[0];
        const todayOrders = this.completedOrders.filter(order => 
            order.completedTime && order.completedTime.startsWith(today)
        );
        
        const todayRevenue = todayOrders.reduce((sum, order) => sum + order.total, 0);
        const todayItems = todayOrders.reduce((sum, order) => 
            sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
        
        const todayOrdersEl = document.getElementById('today-orders');
        const todayRevenueEl = document.getElementById('today-revenue');
        const todayItemsEl = document.getElementById('today-items');
        
        if (todayOrdersEl) todayOrdersEl.textContent = todayOrders.length;
        if (todayRevenueEl) todayRevenueEl.textContent = `₹${todayRevenue.toFixed(2)}`;
        if (todayItemsEl) todayItemsEl.textContent = todayItems;
    }
    
    updateBadges() {
        const ongoingBadge = document.getElementById('ongoing-badge');
        const completedBadge = document.getElementById('completed-badge');
        
        if (ongoingBadge) ongoingBadge.textContent = this.orders.length;
        if (completedBadge) completedBadge.textContent = this.completedOrders.length;
    }
    
    updateNextOrderNumber() {
        const nextOrderNumber = document.getElementById('next-order-number');
        if (nextOrderNumber) {
            nextOrderNumber.textContent = this.nextOrderId;
        }
    }
    
    async placeOrder(button) {
        if (this.currentOrder.items.length === 0) {
            this.showNotification('Please add items to the order', 'error');
            return;
        }
        
        if (!this.businessId) {
            this.showNotification('Please set up your business profile first', 'error');
            this.switchTab('profile');
            return;
        }
        
        await this.withLoading(async () => {
            const subtotal = this.currentOrder.items.reduce((sum, item) => sum + item.subtotal, 0);
            const totalTax = this.currentOrder.items.reduce((sum, item) => sum + item.taxAmount, 0);
            const total = subtotal + totalTax;
            const totalCost = this.currentOrder.items.reduce((sum, item) => 
                sum + (item.totalCost || (item.quantity * item.cost)), 0);
            const totalProfit = total - totalCost;
            
            const order = {
                customerName: this.currentOrder.customerName,
                customerPhone: this.currentOrder.customerPhone,
                orderType: this.currentOrder.orderType,
                paymentMethod: this.currentOrder.paymentMethod,
                items: this.currentOrder.items.map(item => ({
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    cost: item.cost,
                    quantity: item.quantity,
                    tax: item.tax,
                    taxAmount: item.taxAmount,
                    subtotal: item.subtotal,
                    total: item.total
                })),
                subtotal: subtotal,
                totalTax: totalTax,
                total: total,
                totalCost: totalCost,
                totalProfit: totalProfit,
                orderTime: new Date().toISOString(),
                status: 'preparing',
                orderNumber: this.nextOrderId,
                businessId: this.businessId
            };
            
            try {
                const orderRef = await this.db.collection('businesses')
                    .doc(this.businessId)
                    .collection('orders')
                    .add({
                        ...order,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                
                await this.db.collection('businesses').doc(this.businessId).update({
                    nextOrderId: this.nextOrderId + 1,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                order.id = orderRef.id;
                this.orders.unshift(order);
                
                this.nextOrderId++;
                
                this.saveData('nextOrderId', this.nextOrderId);
                this.saveData('orders', this.orders);
                
                this.clearCurrentOrder();
                
                this.updateBadges();
                this.updateStats();
                this.updateNextOrderNumber();
                
                this.showNotification(`Order #${order.orderNumber} placed successfully!`, 'success');
                
                this.switchTab('ongoing-orders');
                
            } catch (error) {
                console.error('Error placing order:', error);
                this.showNotification('Error placing order: ' + error.message, 'error');
            }
        }, 'Placing order...', button);
    }
    
    clearCurrentOrder() {
        this.currentOrder = {
            items: [],
            customerName: '',
            customerPhone: '',
            orderType: 'dine-in',
            paymentMethod: 'cash',
            notes: ''
        };
        
        const customerName = document.getElementById('customer-name');
        const customerPhone = document.getElementById('customer-phone');
        const orderType = document.getElementById('order-type');
        const paymentMethod = document.getElementById('payment-method');
        
        if (customerName) customerName.value = '';
        if (customerPhone) customerPhone.value = '';
        if (orderType) orderType.value = 'dine-in';
        if (paymentMethod) paymentMethod.value = 'cash';
        
        this.menu.forEach(item => {
            const input = document.getElementById(`qty-${item.id}`);
            if (input) input.value = 0;
            
            const menuCard = document.querySelector(`.menu-item-card[data-item-id="${item.id}"]`);
            if (menuCard) menuCard.classList.remove('selected');
        });
        
        this.updateSelectedItemsTable();
        this.updateSummary();
        
        if (window.innerWidth <= 768) {
            this.updateMobileSelectedItems();
        }
        
        this.showNotification('Order cleared successfully', 'success');
    }
    
    updateQuickActions() {
        const quickActionsContainer = document.querySelector('#quick-actions-container');
        if (!quickActionsContainer) return;
        
        quickActionsContainer.innerHTML = '';
        
        const favoriteCategories = this.categories.filter(cat => cat.favorite);
        
        if (favoriteCategories.length === 0) {
            quickActionsContainer.innerHTML = `
                <div class="col-12 text-center py-3">
                    <p class="text-muted small">Mark categories as favorites in Menu Management</p>
                </div>
            `;
            return;
        }
        
        favoriteCategories.forEach((category, index) => {
            if (index >= 6) return;
            
            const col = document.createElement('div');
            col.className = 'col-6';
            
            const icon = this.getCategoryIcon(category.name);
            
            col.innerHTML = `
                <button class="btn btn-outline-info w-100 quick-category-btn" 
                        data-category="${category.name}">
                    <i class="fas fa-${icon} me-1"></i> ${category.name}
                </button>
            `;
            
            quickActionsContainer.appendChild(col);
            
            col.querySelector('.quick-category-btn').addEventListener('click', (e) => {
                const categoryName = e.currentTarget.getAttribute('data-category');
                this.showCategory(categoryName);
            });
        });
    }
    
    getCategoryIcon(categoryName) {
        const lowerCategory = categoryName.toLowerCase();
        if (lowerCategory.includes('drink') || lowerCategory.includes('beverage')) return 'wine-glass';
        if (lowerCategory.includes('dessert') || lowerCategory.includes('sweet')) return 'ice-cream';
        if (lowerCategory.includes('appetizer') || lowerCategory.includes('starter')) return 'apple-alt';
        if (lowerCategory.includes('wrap') || lowerCategory.includes('roll')) return 'bread-slice';
        if (lowerCategory.includes('burger') || lowerCategory.includes('sandwich')) return 'hamburger';
        if (lowerCategory.includes('pizza') || lowerCategory.includes('pie')) return 'pizza-slice';
        if (lowerCategory.includes('salad') || lowerCategory.includes('bowl')) return 'leaf';
        if (lowerCategory.includes('soup') || lowerCategory.includes('broth')) return 'bowl';
        if (lowerCategory.includes('main') || lowerCategory.includes('course')) return 'utensils';
        if (lowerCategory.includes('side') || lowerCategory.includes('extra')) return 'plate';
        return 'tag';
    }
    
    showCategory(category) {
        const element = document.getElementById(`category-${category.replace(/\s+/g, '-')}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
    
    // ================= ORDER DETAILS =================
    
    viewOrderDetails(orderId) {
        const order = this.orders.find(o => o.id == orderId) || 
                     this.completedOrders.find(o => o.id == orderId);
        
        if (!order) {
            this.showNotification('Order not found', 'error');
            return;
        }
        
        document.getElementById('modal-order-no').textContent = order.orderNumber || order.id;
        document.getElementById('modal-customer').textContent = order.customerName || 'Walk-in';
        document.getElementById('modal-phone').textContent = order.customerPhone || 'N/A';
        document.getElementById('modal-order-time').textContent = new Date(order.orderTime).toLocaleString();
        document.getElementById('modal-order-type').textContent = order.orderType;
        
        let itemsHtml = '';
        let subtotal = 0;
        let totalTax = 0;
        let total = 0;
        
        order.items.forEach(item => {
            subtotal += item.subtotal || (item.price * item.quantity);
            totalTax += item.taxAmount || 0;
            total += item.total || (item.price * item.quantity);
            
            itemsHtml += `
                <tr>
                    <td>${item.name}${item.tax > 0 ? `<br><small class="text-muted">${item.tax}% tax</small>` : ''}</td>
                    <td>${item.quantity}</td>
                    <td>₹${item.price}</td>
                    <td>₹${item.total ? item.total.toFixed(2) : (item.price * item.quantity).toFixed(2)}</td>
                </tr>
            `;
        });
        
        document.getElementById('modal-items-body').innerHTML = itemsHtml;
        
        let totalHtml = '';
        if (order.subtotal && order.totalTax) {
            totalHtml = `
                <tr class="table-light">
                    <td colspan="3" class="text-end"><strong>Subtotal:</strong></td>
                    <td><strong>₹${order.subtotal.toFixed(2)}</strong></td>
                </tr>
                <tr class="table-light">
                    <td colspan="3" class="text-end"><strong>Tax:</strong></td>
                    <td><strong>₹${order.totalTax.toFixed(2)}</strong></td>
                </tr>
                <tr class="table-success">
                    <td colspan="3" class="text-end"><strong>Total:</strong></td>
                    <td><strong>₹${order.total.toFixed(2)}</strong></td>
                </tr>
            `;
        } else {
            totalHtml = `
                <tr class="table-light">
                    <td colspan="3" class="text-end"><strong>Subtotal:</strong></td>
                    <td><strong>₹${subtotal.toFixed(2)}</strong></td>
                </tr>
                <tr class="table-light">
                    <td colspan="3" class="text-end"><strong>Tax:</strong></td>
                    <td><strong>₹${totalTax.toFixed(2)}</strong></td>
                </tr>
                <tr class="table-success">
                    <td colspan="3" class="text-end"><strong>Total:</strong></td>
                    <td><strong>₹${total.toFixed(2)}</strong></td>
                </tr>
            `;
        }
        
        document.getElementById('modal-total').innerHTML = totalHtml;
        
        const completeBtn = document.getElementById('complete-order-btn');
        completeBtn.setAttribute('data-order-id', order.id);
        
        if (order.status === 'completed') {
            completeBtn.style.display = 'none';
        } else {
            completeBtn.style.display = 'inline-block';
        }
        
        const modal = new bootstrap.Modal(document.getElementById('orderDetailsModal'));
        modal.show();
    }
    
    async completeOrder(orderId, button) {
        const orderIndex = this.orders.findIndex(o => o.id == orderId);
        if (orderIndex === -1) return;
        
        await this.withLoading(async () => {
            try {
                const [completedOrder] = this.orders.splice(orderIndex, 1);
                
                await this.db.collection('businesses')
                    .doc(this.businessId)
                    .collection('orders')
                    .doc(orderId)
                    .update({
                        status: 'completed',
                        completedTime: new Date().toISOString(),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                
                completedOrder.status = 'completed';
                completedOrder.completedTime = new Date().toISOString();
                
                this.completedOrders.unshift(completedOrder);
                
                this.saveData('orders', this.orders);
                this.saveData('completedOrders', this.completedOrders);
                
                this.renderOngoingOrders();
                this.renderCompletedOrders();
                this.updateBadges();
                this.updateStats();
                
                const currentTab = document.querySelector('.tab-content.active');
                if (currentTab && currentTab.id === 'analytics') {
                    this.updateAnalytics();
                }
                
                this.showNotification(`Order #${completedOrder.orderNumber || completedOrder.id} completed!`, 'success');
                
                const modal = bootstrap.Modal.getInstance(document.getElementById('orderDetailsModal'));
                if (modal) modal.hide();
                
            } catch (error) {
                console.error('Error completing order:', error);
                this.showNotification('Error completing order: ' + error.message, 'error');
            }
        }, 'Completing order...', button);
    }
    
    async deleteOrder(orderId, button) {
        if (!confirm('Are you sure you want to delete this order?')) {
            return;
        }
        
        const orderIndex = this.orders.findIndex(o => o.id == orderId);
        if (orderIndex === -1) return;
        
        await this.withLoading(async () => {
            try {
                await this.db.collection('businesses')
                    .doc(this.businessId)
                    .collection('orders')
                    .doc(orderId)
                    .delete();
                
                this.orders.splice(orderIndex, 1);
                
                this.saveData('orders', this.orders);
                
                this.renderOngoingOrders();
                this.updateBadges();
                
                this.showNotification('Order deleted', 'success');
                
            } catch (error) {
                console.error('Error deleting order:', error);
                this.showNotification('Error deleting order: ' + error.message, 'error');
            }
        }, 'Deleting order...', button);
    }
    
    printAllOrders() {
        window.print();
    }
    
    // ================= COMPLETED ORDERS =================
    
    setupDateFilters() {
        const today = new Date().toISOString().split('T')[0];
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
        const twoYearsAgoStr = twoYearsAgo.toISOString().split('T')[0];
        
        const dateFrom = document.getElementById('date-from');
        const dateTo = document.getElementById('date-to');
        
        if (dateFrom) {
            dateFrom.value = today;
            dateFrom.max = today;
            dateFrom.min = twoYearsAgoStr;
        }
        
        if (dateTo) {
            dateTo.value = today;
            dateTo.max = today;
            dateTo.min = twoYearsAgoStr;
        }
        
        const analyticsDateFrom = document.getElementById('analytics-date-from');
        const analyticsDateTo = document.getElementById('analytics-date-to');
        
        if (analyticsDateFrom) {
            analyticsDateFrom.value = today;
            analyticsDateFrom.max = today;
            analyticsDateFrom.min = twoYearsAgoStr;
        }
        
        if (analyticsDateTo) {
            analyticsDateTo.value = today;
            analyticsDateTo.max = today;
            analyticsDateTo.min = twoYearsAgoStr;
        }
    }
    
    getFilteredOrders() {
        const dateFrom = document.getElementById('date-from')?.value;
        const dateTo = document.getElementById('date-to')?.value;
        
        let filteredOrders = this.completedOrders;
        
        if (dateFrom && dateTo) {
            filteredOrders = this.completedOrders.filter(order => {
                const orderDate = order.completedTime ? 
                    order.completedTime.split('T')[0] : 
                    order.orderTime.split('T')[0];
                return orderDate >= dateFrom && orderDate <= dateTo;
            });
        }
        
        return filteredOrders;
    }
    
    renderOngoingOrders() {
        const tbody = document.getElementById('ongoing-orders-body');
        const mobileContainer = document.getElementById('mobile-ongoing-orders');
        const emptyState = document.getElementById('no-ongoing-orders');
        
        if (!tbody || !emptyState) return;
        
        if (this.orders.length === 0) {
            tbody.innerHTML = '';
            if (mobileContainer) mobileContainer.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }
        
        emptyState.style.display = 'none';
        
        // Desktop table view
        let desktopHtml = '';
        
        // Mobile card view
        let mobileHtml = '';
        
        this.orders.forEach(order => {
            const orderTime = new Date(order.orderTime);
            const itemsCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
            const itemsText = order.items.slice(0, 2).map(item => `${item.name} (x${item.quantity})`).join(', ');
            const moreItems = order.items.length > 2 ? ` +${order.items.length - 2} more` : '';
            
            // Desktop row
            desktopHtml += `
                <tr>
                    <td>
                        <button class="btn btn-sm btn-danger delete-order-btn" data-order-id="${order.id}" title="Delete Order">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                    <td><strong>#${order.orderNumber || order.id}</strong></td>
                    <td>${orderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>${order.customerName || 'Walk-in'}</td>
                    <td>${itemsText}${moreItems}</td>
                    <td>₹${order.total ? order.total.toFixed(2) : order.total}</td>
                    <td>
                        <span class="status-badge status-${order.status}">
                            ${order.status}
                        </span>
                    </td>
                    <td>
                        <div class="d-flex gap-2">
                            <button class="btn btn-sm btn-outline-primary view-order-btn" data-order-id="${order.id}" title="View Order">
                                <i class="fas fa-eye"></i> View
                            </button>
                            <button class="btn btn-sm btn-success complete-order-btn" data-order-id="${order.id}" title="Complete Order">
                                <i class="fas fa-check me-1"></i> Complete
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            
            // Mobile card
            mobileHtml += `
                <div class="order-card-mobile">
                    <div class="order-card-header">
                        <div>
                            <div class="order-card-number">#${order.orderNumber || order.id}</div>
                            <div class="order-card-time">${orderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                        <span class="order-card-status status-${order.status}">${order.status}</span>
                    </div>
                    
                    <div class="order-card-customer">
                        <strong>Customer:</strong> ${order.customerName || 'Walk-in'}
                    </div>
                    
                    <div class="order-card-items">
                        ${order.items.slice(0, 3).map(item => `
                            <div class="order-card-item">
                                <span>${item.name}</span>
                                <span>x${item.quantity}</span>
                            </div>
                        `).join('')}
                        ${order.items.length > 3 ? `
                            <div class="order-card-item text-muted">
                                <span>+${order.items.length - 3} more items</span>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="order-card-total">
                        Total: ₹${order.total ? order.total.toFixed(2) : order.total}
                    </div>
                    
                    <div class="order-card-actions">
                        <button class="btn btn-outline-primary view-order-btn" data-order-id="${order.id}">
                            <i class="fas fa-eye me-1"></i> View
                        </button>
                        <button class="btn btn-success complete-order-btn" data-order-id="${order.id}">
                            <i class="fas fa-check me-1"></i> Complete
                        </button>
                        <button class="btn btn-outline-danger delete-order-btn" data-order-id="${order.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        tbody.innerHTML = desktopHtml;
        if (mobileContainer) mobileContainer.innerHTML = mobileHtml;
        
        // Add event listeners
        this.addOrderEventListeners();
    }
    
    addOrderEventListeners() {
        // View order buttons
        document.querySelectorAll('.view-order-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const orderId = e.currentTarget.getAttribute('data-order-id');
                this.viewOrderDetails(orderId);
            });
        });
        
        // Complete order buttons
        document.querySelectorAll('.complete-order-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const orderId = e.currentTarget.getAttribute('data-order-id');
                this.completeOrder(orderId, btn);
            });
        });
        
        // Delete order buttons
        document.querySelectorAll('.delete-order-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const orderId = e.currentTarget.getAttribute('data-order-id');
                this.deleteOrder(orderId, btn);
            });
        });
    }
    
    renderCompletedOrders() {
        const tbody = document.getElementById('completed-orders-body');
        const mobileContainer = document.getElementById('mobile-completed-orders');
        const emptyState = document.getElementById('no-completed-orders');
        
        if (!tbody || !emptyState) return;
        
        const filteredOrders = this.getFilteredOrders();
        
        if (filteredOrders.length === 0) {
            tbody.innerHTML = '';
            if (mobileContainer) mobileContainer.innerHTML = '';
            emptyState.style.display = 'block';
            this.updateSalesSummary(filteredOrders);
            return;
        }
        
        emptyState.style.display = 'none';
        
        // Desktop table view
        let desktopHtml = '';
        
        // Mobile card view
        let mobileHtml = '';
        
        filteredOrders.forEach(order => {
            const orderTime = new Date(order.orderTime);
            const completedTime = new Date(order.completedTime);
            const itemsCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
            const profit = order.totalProfit || (order.total - (order.totalCost || 0));
            const profitClass = profit >= 0 ? 'profit-positive' : 'profit-negative';
            
            // Desktop row
            desktopHtml += `
                <tr>
                    <td><strong>#${order.orderNumber || order.id}</strong></td>
                    <td>${orderTime.toLocaleDateString()}</td>
                    <td>${order.customerName || 'Walk-in'}</td>
                    <td>${itemsCount} items</td>
                    <td>₹${order.total ? order.total.toFixed(2) : order.total}</td>
                    <td class="${profitClass}">₹${profit.toFixed(2)}</td>
                    <td>${completedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                </tr>
            `;
            
            // Mobile card
            mobileHtml += `
                <div class="completed-card-mobile">
                    <div class="completed-card-header">
                        <div class="completed-card-number">#${order.orderNumber || order.id}</div>
                        <div class="completed-card-date">${orderTime.toLocaleDateString()}</div>
                    </div>
                    
                    <div class="completed-card-details">
                        <div class="completed-card-row">
                            <span>Customer:</span>
                            <span>${order.customerName || 'Walk-in'}</span>
                        </div>
                        <div class="completed-card-row">
                            <span>Items:</span>
                            <span>${itemsCount}</span>
                        </div>
                        <div class="completed-card-row">
                            <span>Completed:</span>
                            <span>${completedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    </div>
                    
                    <div class="completed-card-total">
                        ₹${order.total ? order.total.toFixed(2) : order.total}
                    </div>
                    
                    <div class="completed-card-profit ${profitClass}">
                        Profit: ₹${profit.toFixed(2)}
                    </div>
                </div>
            `;
        });
        
        tbody.innerHTML = desktopHtml;
        if (mobileContainer) mobileContainer.innerHTML = mobileHtml;
        
        // Update sales summary
        this.updateSalesSummary(filteredOrders);
    }
    
    updateSalesSummary(orders) {
        const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
        const totalCost = orders.reduce((sum, order) => sum + (order.totalCost || 0), 0);
        const totalProfit = totalRevenue - totalCost;
        const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0;
        const totalOrders = orders.length;
        
        const totalRevenueEl = document.getElementById('total-revenue');
        const totalOrdersEl = document.getElementById('total-orders');
        const totalProfitEl = document.getElementById('total-profit');
        const profitMarginEl = document.getElementById('profit-margin');
        
        if (totalRevenueEl) totalRevenueEl.textContent = `₹${totalRevenue.toFixed(2)}`;
        if (totalOrdersEl) totalOrdersEl.textContent = totalOrders;
        if (totalProfitEl) totalProfitEl.textContent = `₹${totalProfit.toFixed(2)}`;
        if (profitMarginEl) profitMarginEl.textContent = `${profitMargin}%`;
        
        const itemSales = {};
        orders.forEach(order => {
            order.items.forEach(item => {
                if (!itemSales[item.name]) {
                    itemSales[item.name] = {
                        quantity: 0,
                        revenue: 0,
                        cost: 0,
                        profit: 0
                    };
                }
                const itemCost = item.cost || 0;
                const itemProfit = item.total - (itemCost * item.quantity);
                
                itemSales[item.name].quantity += item.quantity;
                itemSales[item.name].revenue += item.total;
                itemSales[item.name].cost += itemCost * item.quantity;
                itemSales[item.name].profit += itemProfit;
            });
        });
        
        const topItems = Object.entries(itemSales)
            .sort((a, b) => b[1].revenue - a[1].revenue)
            .slice(0, 10);
        
        let topItemsHtml = '';
        topItems.forEach(([itemName, data]) => {
            const margin = data.revenue > 0 ? ((data.profit / data.revenue) * 100).toFixed(1) : 0;
            const profitClass = data.profit >= 0 ? 'profit-positive' : 'profit-negative';
            topItemsHtml += `
                <tr>
                    <td>${itemName}</td>
                    <td>${data.quantity}</td>
                    <td>₹${data.revenue.toFixed(2)}</td>
                    <td class="${profitClass}">₹${data.profit.toFixed(2)}</td>
                    <td>${margin}%</td>
                </tr>
            `;
        });
        
        const topItemsBody = document.getElementById('top-items-body');
        if (topItemsBody) {
            topItemsBody.innerHTML = topItemsHtml || 
                '<tr><td colspan="5" class="text-center text-muted">No data</td></tr>';
        }
    }
    
    async downloadPDFReport(button) {
        const filteredOrders = this.getFilteredOrders();
        
        if (filteredOrders.length === 0) {
            this.showNotification('No completed orders to generate report', 'error');
            return;
        }
        
        const dateFrom = document.getElementById('date-from')?.value || 'All';
        const dateTo = document.getElementById('date-to')?.value || 'All';
        
        await this.withLoading(async () => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            doc.setFont("helvetica", "normal");
            
            doc.setFontSize(20);
            doc.setTextColor(40, 40, 40);
            const title = `Sales Report - ${this.businessData?.name || 'Stall Wise'}`;
            doc.text(title, 105, 15, { align: 'center' });
            
            doc.setFontSize(12);
            doc.setTextColor(100, 100, 100);
            doc.text(`Date Range: ${dateFrom} to ${dateTo}`, 105, 25, { align: 'center' });
            doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 105, 32, { align: 'center' });
            
            const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.total, 0);
            const totalCost = filteredOrders.reduce((sum, order) => sum + (order.totalCost || 0), 0);
            const totalProfit = totalRevenue - totalCost;
            const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) : 0;
            const totalOrders = filteredOrders.length;
            
            doc.setFontSize(14);
            doc.setTextColor(0, 0, 0);
            doc.text('Summary', 20, 45);
            
            doc.setFontSize(11);
            doc.text(`Total Orders: ${totalOrders}`, 20, 55);
            doc.text(`Total Revenue: Rs.${totalRevenue.toFixed(2)}`, 20, 62);
            doc.text(`Total Cost: Rs.${totalCost.toFixed(2)}`, 20, 69);
            doc.text(`Total Profit: Rs.${totalProfit.toFixed(2)}`, 20, 76);
            doc.text(`Profit Margin: ${profitMargin}%`, 20, 83);
            
            const itemSales = {};
            filteredOrders.forEach(order => {
                order.items.forEach(item => {
                    if (!itemSales[item.name]) {
                        itemSales[item.name] = {
                            quantity: 0,
                            revenue: 0,
                            cost: 0,
                            profit: 0
                        };
                    }
                    const itemCost = item.cost || 0;
                    const itemProfit = item.total - (itemCost * item.quantity);
                    
                    itemSales[item.name].quantity += item.quantity;
                    itemSales[item.name].revenue += item.total;
                    itemSales[item.name].cost += itemCost * item.quantity;
                    itemSales[item.name].profit += itemProfit;
                });
            });
            
            const tableData = Object.entries(itemSales).map(([itemName, data], index) => {
                const margin = data.revenue > 0 ? ((data.profit / data.revenue) * 100).toFixed(1) : 0;
                return [
                    index + 1,
                    itemName,
                    data.quantity.toString(),
                    `Rs.${data.revenue.toFixed(2)}`,
                    `Rs.${data.cost.toFixed(2)}`,
                    `Rs.${data.profit.toFixed(2)}`,
                    `${margin}%`
                ];
            });
            
            doc.autoTable({
                head: [['#', 'Item Name', 'Qty', 'Revenue', 'Cost', 'Profit', 'Margin']],
                body: tableData,
                startY: 90,
                theme: 'grid',
                headStyles: { 
                    fillColor: [255, 107, 53],
                    fontStyle: 'normal'
                },
                styles: {
                    font: 'helvetica',
                    fontStyle: 'normal'
                }
            });
            
            const filename = `sales-report-${dateFrom === 'All' ? 'all' : dateFrom}-to-${dateTo === 'All' ? 'all' : dateTo}.pdf`;
            doc.save(filename);
            
            this.showNotification('PDF report downloaded successfully!', 'success');
        }, 'Generating PDF...', button);
    }
    
    async clearCompletedOrders(button) {
        if (this.completedOrders.length === 0) {
            this.showNotification('No completed orders to clear', 'error');
            return;
        }
        
        if (confirm('Are you sure you want to clear all completed orders? This action cannot be undone.')) {
            await this.withLoading(async () => {
                try {
                    for (const order of this.completedOrders) {
                        await this.db.collection('businesses')
                            .doc(this.businessId)
                            .collection('orders')
                            .doc(order.id)
                            .delete();
                    }
                    
                    this.completedOrders = [];
                    
                    this.saveData('completedOrders', this.completedOrders);
                    
                    this.renderCompletedOrders();
                    this.updateBadges();
                    
                    this.showNotification('All completed orders cleared', 'success');
                } catch (error) {
                    console.error('Error clearing completed orders:', error);
                    this.showNotification('Error clearing completed orders', 'error');
                }
            }, 'Clearing orders...', button);
        }
    }
    
    // ================= MENU MANAGEMENT =================
    
    renderMenuManagement() {
        const tbody = document.getElementById('menu-management-body');
        const mobileContainer = document.getElementById('mobile-menu-list');
        
        if (!tbody) return;
        
        if (this.menu.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-4">
                        <i class="fas fa-utensils fa-2x text-muted mb-2"></i>
                        <p class="text-muted">No menu items added yet</p>
                        <button class="btn btn-sm btn-primary mt-2" id="add-first-item-btn">
                            <i class="fas fa-plus me-1"></i> Add First Item
                        </button>
                    </td>
                </tr>
            `;
            
            if (mobileContainer) {
                mobileContainer.innerHTML = `
                    <div class="text-center py-5">
                        <i class="fas fa-utensils fa-3x text-muted mb-3"></i>
                        <h5 class="text-muted">No Menu Items</h5>
                        <p class="text-muted">Add your first menu item</p>
                        <button class="btn btn-primary mt-3" id="add-first-item-mobile-btn">
                            <i class="fas fa-plus me-1"></i> Add Item
                        </button>
                    </div>
                `;
            }
            
            // Add event listeners
            setTimeout(() => {
                document.getElementById('add-first-item-btn')?.addEventListener('click', () => {
                    this.showNewCategoryInput();
                });
                document.getElementById('add-first-item-mobile-btn')?.addEventListener('click', () => {
                    this.showNewCategoryInput();
                });
            }, 100);
            
            return;
        }
        
        // Desktop table view
        let desktopHtml = '';
        
        // Mobile card view
        let mobileHtml = '';
        
        // Group items by category
        const itemsByCategory = {};
        this.menu.forEach(item => {
            if (!itemsByCategory[item.category]) {
                itemsByCategory[item.category] = [];
            }
            itemsByCategory[item.category].push(item);
        });
        
        // Render by category
        this.categories.forEach(categoryObj => {
            const categoryName = categoryObj.name || categoryObj;
            const items = itemsByCategory[categoryName] || [];
            
            // Desktop category header
            desktopHtml += `
                <tr class="category-header" style="background-color: #f8f9fa;">
                    <td colspan="8">
                        <strong>${categoryName}</strong>
                    </td>
                </tr>
            `;
            
            // Items for this category
            items.forEach(item => {
                const profit = (item.price - item.cost);
                const profitMargin = item.price > 0 ? ((profit / item.price) * 100).toFixed(1) : 0;
                const profitClass = profit >= 0 ? 'profit-positive' : 'profit-negative';
                
                // Desktop row
                desktopHtml += `
                    <tr class="menu-item-row ${item.outOfStock ? 'out-of-stock' : ''}" data-item-id="${item.id}">
                        <td>${item.category}</td>
                        <td>
                            <div class="d-flex align-items-center">
                                <span class="item-name">${item.name}</span>
                                ${item.outOfStock ? '<span class="badge bg-danger ms-2">Out of Stock</span>' : ''}
                            </div>
                        </td>
                        <td>₹${item.cost}</td>
                        <td>₹${item.price}</td>
                        <td>${item.tax || 0}%</td>
                        <td class="${profitClass}">₹${profit.toFixed(2)}</td>
                        <td>
                            <div class="form-check">
                                <input class="form-check-input out-of-stock-checkbox" 
                                       type="checkbox" 
                                       data-item-id="${item.id}"
                                       ${item.outOfStock ? 'checked' : ''}>
                            </div>
                        </td>
                        <td>
                            <div class="d-flex gap-2">
                                <button class="btn btn-sm btn-outline-primary edit-item-btn" 
                                        data-item-id="${item.id}" title="Edit">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger delete-item-btn" 
                                        data-item-id="${item.id}" title="Delete">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
                
                // Mobile card
                mobileHtml += `
                    <div class="menu-item-card-mobile" data-item-id="${item.id}">
                        ${item.outOfStock ? '<div class="out-of-stock-badge">Out of Stock</div>' : ''}
                        <div class="menu-item-header">
                            <div class="menu-item-name-mobile">${item.name}</div>
                            <span class="menu-item-category">${item.category}</span>
                        </div>
                        
                        <div class="menu-item-details">
                            <div>
                                <div class="menu-item-price-mobile">₹${item.price}</div>
                                <div class="menu-item-cost">Cost: ₹${item.cost}</div>
                            </div>
                            <div class="text-right">
                                <div class="text-success">Tax: ${item.tax || 0}%</div>
                                <div class="${profitClass}">Profit: ₹${profit.toFixed(2)}</div>
                            </div>
                        </div>
                        
                        <div class="menu-item-stats">
                            <div class="stat-box">
                                <div class="stat-label-mobile">Cost</div>
                                <div class="stat-value-mobile">₹${item.cost}</div>
                            </div>
                            <div class="stat-box">
                                <div class="stat-label-mobile">Price</div>
                                <div class="stat-value-mobile">₹${item.price}</div>
                            </div>
                            <div class="stat-box">
                                <div class="stat-label-mobile">Margin</div>
                                <div class="stat-value-mobile ${profitClass}">${profitMargin}%</div>
                            </div>
                        </div>
                        
                        <div class="menu-item-actions">
                            <button class="btn btn-outline-primary edit-item-btn" data-item-id="${item.id}">
                                <i class="fas fa-edit me-1"></i> Edit
                            </button>
                            <button class="btn btn-outline-danger delete-item-btn" data-item-id="${item.id}">
                                <i class="fas fa-trash me-1"></i> Delete
                            </button>
                        </div>
                    </div>
                `;
            });
        });
        
        tbody.innerHTML = desktopHtml;
        if (mobileContainer) mobileContainer.innerHTML = mobileHtml;
        
        // Add event listeners
        this.addMenuManagementEventListeners();
    }
    
    addMenuManagementEventListeners() {
        // Edit buttons
        document.querySelectorAll('.edit-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const itemId = e.currentTarget.getAttribute('data-item-id');
                this.editMenuItem(itemId);
            });
        });
        
        // Delete buttons
        document.querySelectorAll('.delete-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const itemId = e.currentTarget.getAttribute('data-item-id');
                this.deleteMenuItem(itemId, btn);
            });
        });
        
        // Out of stock checkboxes
        document.querySelectorAll('.out-of-stock-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const itemId = e.target.getAttribute('data-item-id');
                const isOutOfStock = e.target.checked;
                this.updateItemStockStatus(itemId, isOutOfStock, checkbox);
            });
        });
        
        // Clickable rows (desktop)
        document.querySelectorAll('.menu-item-row').forEach(row => {
            row.addEventListener('click', (e) => {
                if (!e.target.closest('.btn') && !e.target.closest('.form-check')) {
                    const itemId = row.getAttribute('data-item-id');
                    this.editMenuItem(itemId);
                }
            });
        });
        
        // Clickable cards (mobile)
        document.querySelectorAll('.menu-item-card-mobile').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.btn')) {
                    const itemId = card.getAttribute('data-item-id');
                    this.editMenuItem(itemId);
                }
            });
        });
    }
    
    loadCategoriesDropdown() {
        const categorySelect = document.getElementById('item-category');
        if (!categorySelect) return;
        
        categorySelect.innerHTML = '<option value="">Select Category</option>';
        
        if (this.categories.length === 0) {
            categorySelect.innerHTML = `
                <option value="">No categories yet</option>
                <option value="" disabled>Click "+" to add first category</option>
            `;
            return;
        }
        
        this.categories.forEach(category => {
            const categoryName = category.name || category;
            const option = document.createElement('option');
            option.value = categoryName;
            option.textContent = categoryName;
            categorySelect.appendChild(option);
        });
    }
    
    showNewCategoryInput() {
        document.getElementById('new-category-input').style.display = 'block';
        document.getElementById('new-category-name').focus();
    }
    
    hideNewCategoryInput() {
        document.getElementById('new-category-input').style.display = 'none';
        document.getElementById('new-category-name').value = '';
    }
    
    async saveNewCategory(button) {
        const categoryInput = document.getElementById('new-category-name');
        const categoryName = categoryInput.value.trim().toUpperCase();
        
        if (!categoryName) {
            this.showNotification('Please enter a category name', 'error');
            return;
        }
        
        const exists = this.categories.some(cat => 
            (cat.name || cat) === categoryName
        );
        
        if (exists) {
            this.showNotification('Category already exists', 'error');
            return;
        }
        
        await this.withLoading(async () => {
            try {
                this.categories.push({
                    name: categoryName,
                    favorite: false
                });
                
                await this.db.collection('businesses').doc(this.businessId).update({
                    categories: this.categories,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                this.loadCategoriesDropdown();
                this.hideNewCategoryInput();
                
                categoryInput.value = '';
                
                this.showNotification(`Category "${categoryName}" added successfully`, 'success');
                
                if (this.categories.length === 1) {
                    this.renderMenuManagement();
                }
                
            } catch (error) {
                console.error('Error saving category:', error);
                this.showNotification('Error saving category', 'error');
            }
        }, 'Saving category...', button);
    }
    
    editMenuItem(itemId) {
        const item = this.menu.find(item => item.id === itemId);
        if (!item) return;
        
        document.getElementById('item-category').value = item.category;
        document.getElementById('item-name').value = item.name;
        document.getElementById('item-price').value = item.price;
        document.getElementById('item-cost').value = item.cost;
        document.getElementById('item-tax').value = item.tax || 0;
        document.getElementById('item-out-of-stock').checked = item.outOfStock || false;
        document.getElementById('edit-item-id').value = itemId;
        
        const submitBtn = document.querySelector('#menu-item-form button[type="submit"]');
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-save me-1"></i> Update Item';
            submitBtn.classList.remove('btn-success');
            submitBtn.classList.add('btn-primary');
        }
        
        document.getElementById('menu-item-form').scrollIntoView({ behavior: 'smooth' });
    }
    
    cancelEditMenuItem() {
        this.resetMenuItemForm();
    }
    
    resetMenuItemForm() {
        document.getElementById('menu-item-form').reset();
        document.getElementById('item-tax').value = 0;
        document.getElementById('item-out-of-stock').checked = false;
        document.getElementById('edit-item-id').value = '';
        
        const submitBtn = document.querySelector('#menu-item-form button[type="submit"]');
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-save me-1"></i> Save Item';
            submitBtn.classList.remove('btn-primary');
            submitBtn.classList.add('btn-success');
        }
    }
    
    async saveMenuItem(button) {
        const category = document.getElementById('item-category').value;
        const name = document.getElementById('item-name').value.trim();
        const price = parseFloat(document.getElementById('item-price').value);
        const cost = parseFloat(document.getElementById('item-cost').value);
        const tax = parseFloat(document.getElementById('item-tax').value) || 0;
        const outOfStock = document.getElementById('item-out-of-stock').checked;
        const itemId = document.getElementById('edit-item-id').value;
        
        if (!category || !name || !price || isNaN(cost)) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }
        
        if (price <= 0) {
            this.showNotification('Price must be positive', 'error');
            return;
        }
        
        if (cost < 0) {
            this.showNotification('Cost cannot be negative', 'error');
            return;
        }
        
        if (cost > price) {
            this.showNotification('Cost cannot be greater than price', 'error');
            return;
        }
        
        if (tax < 0 || tax > 100) {
            this.showNotification('Tax must be between 0 and 100 percent', 'error');
            return;
        }
        
        await this.withLoading(async () => {
            try {
                const itemData = {
                    category: category,
                    name: name,
                    price: price,
                    cost: cost,
                    tax: tax,
                    outOfStock: outOfStock,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                if (itemId) {
                    await this.db.collection('businesses')
                        .doc(this.businessId)
                        .collection('menu')
                        .doc(itemId)
                        .update(itemData);
                    
                    const index = this.menu.findIndex(item => item.id === itemId);
                    if (index !== -1) {
                        this.menu[index] = { ...this.menu[index], ...itemData };
                    }
                    
                    this.showNotification('Menu item updated successfully', 'success');
                } else {
                    itemData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    
                    const newItemRef = await this.db.collection('businesses')
                        .doc(this.businessId)
                        .collection('menu')
                        .add(itemData);
                    
                    this.menu.push({
                        id: newItemRef.id,
                        ...itemData
                    });
                    
                    this.showNotification('Menu item added successfully', 'success');
                }
                
                this.resetMenuItemForm();
                
                this.renderMenuManagement();
                this.renderMenu();
                
                this.saveData('menu', this.menu);
                
            } catch (error) {
                console.error('Error saving menu item:', error);
                this.showNotification('Error saving menu item', 'error');
            }
        }, 'Saving menu item...', button);
    }
    
    async deleteMenuItem(itemId, button) {
        if (!confirm('Are you sure you want to delete this menu item?')) {
            return;
        }
        
        await this.withLoading(async () => {
            try {
                await this.db.collection('businesses')
                    .doc(this.businessId)
                    .collection('menu')
                    .doc(itemId)
                    .delete();
                
                this.menu = this.menu.filter(item => item.id !== itemId);
                
                this.renderMenuManagement();
                this.renderMenu();
                
                this.saveData('menu', this.menu);
                
                if (document.getElementById('edit-item-id').value === itemId) {
                    this.resetMenuItemForm();
                }
                
                this.showNotification('Menu item deleted successfully', 'success');
                
            } catch (error) {
                console.error('Error deleting menu item:', error);
                this.showNotification('Error deleting menu item', 'error');
            }
        }, 'Deleting menu item...', button);
    }
    
    async updateItemStockStatus(itemId, isOutOfStock, checkbox) {
        await this.withLoading(async () => {
            try {
                await this.db.collection('businesses')
                    .doc(this.businessId)
                    .collection('menu')
                    .doc(itemId)
                    .update({
                        outOfStock: isOutOfStock,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                
                const itemIndex = this.menu.findIndex(item => item.id === itemId);
                if (itemIndex !== -1) {
                    this.menu[itemIndex].outOfStock = isOutOfStock;
                }
                
                this.saveData('menu', this.menu);
                
                const row = checkbox.closest('.menu-item-row');
                if (row) {
                    if (isOutOfStock) {
                        row.classList.add('out-of-stock');
                        if (!row.querySelector('.badge.bg-danger')) {
                            const nameCell = row.querySelector('.item-name');
                            if (nameCell) {
                                nameCell.insertAdjacentHTML('afterend', 
                                    '<span class="badge bg-danger ms-2">Out of Stock</span>'
                                );
                            }
                        }
                    } else {
                        row.classList.remove('out-of-stock');
                        const badge = row.querySelector('.badge.bg-danger');
                        if (badge) badge.remove();
                    }
                }
                
                this.renderMenu();
                
                this.showNotification(
                    `Item marked as ${isOutOfStock ? 'out of stock' : 'available'}`, 
                    'success'
                );
                
            } catch (error) {
                console.error('Error updating item stock status:', error);
                this.showNotification('Error updating item status', 'error');
                
                checkbox.checked = !isOutOfStock;
            }
        }, 'Updating item status...');
    }
    
    // ================= FIREBASE DATA =================
    
    async loadBusinessData() {
        try {
            const businessDoc = await this.db.collection('businesses').doc(this.businessId).get();
            if (businessDoc.exists) {
                this.businessData = businessDoc.data();
                
                let categoriesData = this.businessData.categories || [];
                if (categoriesData.length > 0 && typeof categoriesData[0] === 'string') {
                    categoriesData = categoriesData.map(name => ({ 
                        name, 
                        favorite: false 
                    }));
                    
                    await this.db.collection('businesses').doc(this.businessId).update({
                        categories: categoriesData
                    });
                }
                
                this.categories = categoriesData;
                this.nextOrderId = this.businessData.nextOrderId || 1001;
                this.updateNextOrderNumber();
                this.updateMenuTabName();
                this.updateAppName();
            }
            
            await this.loadMenuFromFirestore();
            
            const ordersSnapshot = await this.db.collection('businesses')
                .doc(this.businessId)
                .collection('orders')
                .get();
            
            const allOrders = ordersSnapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data(),
                orderNumber: doc.data().orderNumber || 0
            }));
            
            this.orders = allOrders
                .filter(order => order.status === 'preparing' || order.status === 'ready')
                .sort((a, b) => new Date(b.orderTime) - new Date(a.orderTime));
            
            this.completedOrders = allOrders
                .filter(order => order.status === 'completed')
                .sort((a, b) => new Date(b.completedTime || b.orderTime) - new Date(a.completedTime || a.orderTime))
                .slice(0, 50);
            
            this.renderMenu();
            this.updateQuickActions();
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
    
    async loadMenuFromFirestore() {
        try {
            const menuSnapshot = await this.db.collection('businesses')
                .doc(this.businessId)
                .collection('menu')
                .orderBy('category')
                .get();
            
            if (!menuSnapshot.empty) {
                this.menu = menuSnapshot.docs.map(doc => ({ 
                    id: doc.id, 
                    ...doc.data(),
                    cost: doc.data().cost || 0,
                    tax: doc.data().tax || 0,
                    outOfStock: doc.data().outOfStock || false
                }));
                
                this.saveData('menu', this.menu);
            }
        } catch (error) {
            console.error('Error loading menu:', error);
            this.showNotification('Error loading menu', 'error');
        }
    }
    
    // ================= PROFILE =================
    
    updateAppName() {
        const brandName = document.getElementById('brand-name');
        const appTitle = document.querySelector('title');
        
        if (this.businessData && this.businessData.name) {
            if (brandName) brandName.textContent = this.businessData.name;
            if (appTitle) appTitle.textContent = this.businessData.name;
        } else {
            if (brandName) brandName.textContent = 'Stall Wise';
            if (appTitle) appTitle.textContent = 'Stall Wise';
        }
    }
    
    updateMenuTabName() {
        const businessType = this.businessData?.type || 'restaurant';
        const isInventory = businessType === 'other' || businessType === 'event';
        const menuTabLink = document.querySelector('.nav-link[data-tab="menu-management"] .nav-text');
        const menuHeader = document.querySelector('#menu-management .card-title');
        
        if (isInventory) {
            if (menuTabLink) menuTabLink.textContent = 'Inventory';
            if (menuHeader) menuHeader.innerHTML = '<i class="fas fa-edit me-2"></i>Inventory Management';
        } else {
            if (menuTabLink) menuTabLink.textContent = 'Menu';
            if (menuHeader) menuHeader.innerHTML = '<i class="fas fa-edit me-2"></i>Menu Management';
        }
    }
    
    showProfileSetupModal() {
        this.cleanupModalBackdrops();
        
        const modalElement = document.getElementById('profileSetupModal');
        const modal = new bootstrap.Modal(modalElement, {
            backdrop: 'static',
            keyboard: false
        });
        modal.show();
    }
    
    hideProfileSetupModal() {
        const modalElement = document.getElementById('profileSetupModal');
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
            modal.hide();
            
            setTimeout(() => {
                this.cleanupModalBackdrops();
            }, 300);
        }
    }
    
    async saveInitialProfile(button) {
        const businessName = document.getElementById('initial-business-name')?.value;
        const businessType = document.getElementById('initial-business-type')?.value;
        const businessPhone = document.getElementById('initial-business-phone')?.value;
        
        if (!businessName?.trim()) {
            this.showNotification('Please enter a business name', 'error');
            return;
        }
        
        await this.withLoading(async () => {
            try {
                await this.saveBusinessProfile({
                    name: businessName,
                    type: businessType,
                    phone: businessPhone,
                    email: this.currentUser.email
                });
                
                this.hideProfileSetupModal();
            } catch (error) {
                console.error('Error saving initial profile:', error);
                this.showNotification('Error saving profile: ' + error.message, 'error');
            }
        }, 'Setting up business...', button);
    }
    
    async handleBusinessProfileSubmit(button) {
        const businessName = document.getElementById('business-name').value.trim();
        const businessType = document.getElementById('business-type').value;
        const businessDescription = document.getElementById('business-description').value.trim();
        const businessPhone = document.getElementById('business-phone').value.trim();
        const businessEmail = document.getElementById('business-email').value.trim();
        const businessAddress = document.getElementById('business-address').value.trim();
        
        if (!businessName) {
            this.showNotification('Business name is required', 'error');
            return;
        }
        
        await this.withLoading(async () => {
            try {
                const profileData = {
                    name: businessName,
                    type: businessType,
                    description: businessDescription,
                    phone: businessPhone,
                    email: businessEmail || this.currentUser.email,
                    address: businessAddress
                };
                
                await this.saveBusinessProfile(profileData);
                
                this.updateAppName();
                this.updateMenuTabName();
                
            } catch (error) {
                console.error('Error saving business profile:', error);
                this.showNotification('Error saving profile', 'error');
            }
        }, 'Saving profile...', button);
    }
    
    async saveBusinessProfile(profileData) {
        await this.withLoading(async () => {
            try {
                const logoFile = document.getElementById('business-logo').files[0];
                const qrCodeFile = document.getElementById('qr-code').files[0];
                
                if (logoFile) {
                    const logoUrl = await this.uploadFile(
                        logoFile, 
                        `businesses/${this.businessId || 'new'}/logo_${Date.now()}`
                    );
                    profileData.logoUrl = logoUrl;
                }
                
                if (qrCodeFile) {
                    const qrCodeUrl = await this.uploadFile(
                        qrCodeFile,
                        `businesses/${this.businessId || 'new'}/qrcode_${Date.now()}`
                    );
                    profileData.qrCodeUrl = qrCodeUrl;
                }
                
                if (!this.businessId) {
                    const businessRef = await this.db.collection('businesses').add({
                        ...profileData,
                        ownerId: this.currentUser.uid,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        categories: [],
                        nextOrderId: 1001
                    });
                    
                    this.businessId = businessRef.id;
                    
                    await this.db.collection('users').doc(this.currentUser.uid).update({
                        businessId: this.businessId,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                    this.userData.businessId = this.businessId;
                } else {
                    await this.db.collection('businesses').doc(this.businessId).update({
                        ...profileData,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
                
                this.hideProfileSetupModal();
                this.showNotification('Profile saved successfully!', 'success');
                await this.loadBusinessData();
                
            } catch (error) {
                console.error('Error saving business profile:', error);
                this.showNotification('Error saving profile', 'error');
            }
        }, 'Saving profile...');
    }
    
    async uploadFile(file, path) {
        try {
            const storageRef = this.storage.ref();
            const fileRef = storageRef.child(path);
            await fileRef.put(file);
            const downloadURL = await fileRef.getDownloadURL();
            return downloadURL;
        } catch (error) {
            console.error('Error uploading file:', error);
            throw error;
        }
    }
    
    previewImage(input, previewId) {
        const preview = document.getElementById(previewId);
        const file = input.files[0];
        
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.innerHTML = `
                    <img src="${e.target.result}" alt="Preview" class="img-thumbnail" style="max-width: 150px; max-height: 150px;">
                `;
            };
            reader.readAsDataURL(file);
        } else {
            preview.innerHTML = '';
        }
    }
    
    updateUserUI() {
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
    
    updateUIForLoggedInUser() {
        const profileLink = document.getElementById('profile-nav-link');
        if (profileLink && this.currentUser) {
            const userName = this.currentUser.displayName || this.currentUser.email;
            const navText = profileLink.querySelector('.nav-text');
            if (navText) navText.textContent = userName.split('@')[0];
        }
    }
    
    updateProfileTab() {
        if (!this.businessData) {
            document.getElementById('business-info').innerHTML = '<p class="text-muted">No business profile created yet.</p>';
            return;
        }
        
        const businessName = document.getElementById('business-name');
        const businessType = document.getElementById('business-type');
        const businessDescription = document.getElementById('business-description');
        const businessPhone = document.getElementById('business-phone');
        const businessEmail = document.getElementById('business-email');
        const businessAddress = document.getElementById('business-address');
        
        if (businessName) businessName.value = this.businessData.name || '';
        if (businessType) businessType.value = this.businessData.type || 'restaurant';
        if (businessDescription) businessDescription.value = this.businessData.description || '';
        if (businessPhone) businessPhone.value = this.businessData.phone || '';
        if (businessEmail) businessEmail.value = this.businessData.email || '';
        if (businessAddress) businessAddress.value = this.businessData.address || '';
        
        const businessInfoDiv = document.getElementById('business-info');
        if (businessInfoDiv) {
            businessInfoDiv.innerHTML = `
                <p><strong>Name:</strong> ${this.businessData.name}</p>
                <p><strong>Type:</strong> ${this.businessData.type}</p>
                <p><strong>Phone:</strong> ${this.businessData.phone || 'Not set'}</p>
                <p><strong>Email:</strong> ${this.businessData.email}</p>
                <p><strong>Business ID:</strong> <small class="text-muted">${this.businessId}</small></p>
            `;
        }
        
        if (this.businessData.logoUrl) {
            const logoPreview = document.getElementById('logo-preview');
            if (logoPreview) {
                logoPreview.innerHTML = `
                    <img src="${this.businessData.logoUrl}" alt="Business Logo" class="img-thumbnail" style="max-width: 150px; max-height: 150px;">
                `;
            }
        }
        
        const qrCodeSection = document.getElementById('qr-code-section');
        const profileQrCode = document.getElementById('profile-qr-code');
        
        if (this.businessData.qrCodeUrl) {
            qrCodeSection.style.display = 'block';
            profileQrCode.src = this.businessData.qrCodeUrl;
            
            profileQrCode.onclick = () => this.showQRCode();
        } else {
            qrCodeSection.style.display = 'none';
        }
        
        const totalBusinessOrders = document.getElementById('total-business-orders');
        const totalBusinessRevenue = document.getElementById('total-business-revenue');
        const totalBusinessProfit = document.getElementById('total-business-profit');
        
        if (totalBusinessOrders) totalBusinessOrders.textContent = this.completedOrders.length;
        if (totalBusinessRevenue) {
            const totalRevenue = this.completedOrders.reduce((sum, order) => sum + order.total, 0);
            totalBusinessRevenue.textContent = `₹${totalRevenue.toFixed(2)}`;
        }
        if (totalBusinessProfit) {
            const totalProfit = this.completedOrders.reduce((sum, order) => sum + (order.totalProfit || 0), 0);
            totalBusinessProfit.textContent = `₹${totalProfit.toFixed(2)}`;
        }
    }
    
    // ================= MODAL FIXES =================
    
    cleanupModalBackdrops() {
        const backdrops = document.querySelectorAll('.modal-backdrop');
        backdrops.forEach(backdrop => backdrop.remove());
        
        document.body.classList.remove('modal-open');
        document.body.style.paddingRight = '';
        document.body.style.overflow = 'auto';
    }
    
    showQRCode() {
        if (this.businessData && this.businessData.qrCodeUrl) {
            const qrCodeImage = document.getElementById('qrCodeImage');
            qrCodeImage.src = this.businessData.qrCodeUrl;
            
            const modalElement = document.getElementById('qrCodeModal');
            const modal = new bootstrap.Modal(modalElement);
            
            // Clean up event listeners
            modalElement.removeEventListener('hidden.bs.modal', this.handleQRModalClose);
            this.handleQRModalClose = () => {
                this.cleanupModalBackdrops();
            };
            modalElement.addEventListener('hidden.bs.modal', this.handleQRModalClose);
            
            modal.show();
        } else {
            this.showNotification('No QR code uploaded yet', 'warning');
        }
    }
    
    // ================= ANALYTICS =================
    
    updateAnalytics() {
        const dateFrom = document.getElementById('analytics-date-from')?.value;
        const dateTo = document.getElementById('analytics-date-to')?.value;
        
        let filteredOrders = this.completedOrders;
        
        if (dateFrom && dateTo) {
            filteredOrders = this.completedOrders.filter(order => {
                const orderDate = order.completedTime ? 
                    order.completedTime.split('T')[0] : 
                    order.orderTime.split('T')[0];
                return orderDate >= dateFrom && orderDate <= dateTo;
            });
        }
        
        const analyticsRevenue = filteredOrders.reduce((sum, order) => sum + order.total, 0);
        const analyticsProfit = filteredOrders.reduce((sum, order) => sum + (order.totalProfit || 0), 0);
        const analyticsOrders = filteredOrders.length;
        const analyticsMargin = analyticsRevenue > 0 ? ((analyticsProfit / analyticsRevenue) * 100).toFixed(1) : 0;
        
        const analyticsRevenueEl = document.getElementById('analytics-revenue');
        const analyticsProfitEl = document.getElementById('analytics-profit');
        const analyticsOrdersEl = document.getElementById('analytics-orders');
        const analyticsMarginEl = document.getElementById('analytics-margin');
        
        if (analyticsRevenueEl) analyticsRevenueEl.textContent = `₹${analyticsRevenue.toFixed(2)}`;
        if (analyticsProfitEl) analyticsProfitEl.textContent = `₹${analyticsProfit.toFixed(2)}`;
        if (analyticsOrdersEl) analyticsOrdersEl.textContent = analyticsOrders;
        if (analyticsMarginEl) analyticsMarginEl.textContent = `${analyticsMargin}%`;
        
        this.updateCategoryPerformance(filteredOrders);
        this.updateBestSellingItems(filteredOrders);
        this.renderAnalyticsCharts(filteredOrders);
    }
    
    updateCategoryPerformance(orders) {
        const categoryPerformance = {};
        
        orders.forEach(order => {
            order.items.forEach(item => {
                const category = item.category || 'Uncategorized';
                if (!categoryPerformance[category]) {
                    categoryPerformance[category] = {
                        revenue: 0,
                        profit: 0,
                        items: 0
                    };
                }
                
                const itemCost = item.cost || 0;
                const itemProfit = item.total - (itemCost * item.quantity);
                
                categoryPerformance[category].revenue += item.total;
                categoryPerformance[category].profit += itemProfit;
                categoryPerformance[category].items += item.quantity;
            });
        });
        
        const sortedCategories = Object.entries(categoryPerformance)
            .sort((a, b) => b[1].revenue - a[1].revenue)
            .slice(0, 10);
        
        let html = '';
        sortedCategories.forEach(([category, data]) => {
            const margin = data.revenue > 0 ? ((data.profit / data.revenue) * 100).toFixed(1) : 0;
            html += `
                <tr>
                    <td>${category}</td>
                    <td>₹${data.revenue.toFixed(2)}</td>
                    <td>₹${data.profit.toFixed(2)}</td>
                    <td>${margin}%</td>
                </tr>
            `;
        });
        
        const categoryPerformanceBody = document.getElementById('category-performance-body');
        if (categoryPerformanceBody) {
            categoryPerformanceBody.innerHTML = html || 
                '<tr><td colspan="4" class="text-center text-muted">No data</td></tr>';
        }
    }
    
    updateBestSellingItems(orders) {
        const itemSales = {};
        
        orders.forEach(order => {
            order.items.forEach(item => {
                if (!itemSales[item.name]) {
                    itemSales[item.name] = {
                        quantity: 0,
                        revenue: 0,
                        profit: 0
                    };
                }
                
                const itemCost = item.cost || 0;
                const itemProfit = item.total - (itemCost * item.quantity);
                
                itemSales[item.name].quantity += item.quantity;
                itemSales[item.name].revenue += item.total;
                itemSales[item.name].profit += itemProfit;
            });
        });
        
        const bestItems = Object.entries(itemSales)
            .sort((a, b) => b[1].quantity - a[1].quantity)
            .slice(0, 10);
        
        let html = '';
        bestItems.forEach(([itemName, data]) => {
            html += `
                <tr>
                    <td>${itemName}</td>
                    <td>${data.quantity}</td>
                    <td>₹${data.revenue.toFixed(2)}</td>
                    <td>₹${data.profit.toFixed(2)}</td>
                </tr>
            `;
        });
        
        const bestItemsBody = document.getElementById('best-items-body');
        if (bestItemsBody) {
            bestItemsBody.innerHTML = html || 
                '<tr><td colspan="4" class="text-center text-muted">No data</td></tr>';
        }
        
        // Update mobile best items
        if (window.innerWidth <= 768) {
            this.updateMobileBestItems(bestItems);
        }
    }
    
    updateMobileBestItems(bestItems) {
        const mobileContainer = document.getElementById('mobile-best-items');
        if (!mobileContainer) return;
        
        let html = '';
        bestItems.forEach(([itemName, data], index) => {
            if (index >= 5) return; // Limit to 5 items on mobile
            
            html += `
                <div class="best-item-card">
                    <div class="best-item-name">
                        ${itemName}
                    </div>
                    <div class="best-item-stats">
                        <div class="best-item-qty">${data.quantity} sold</div>
                        <div class="best-item-revenue">₹${data.revenue.toFixed(2)}</div>
                    </div>
                </div>
            `;
        });
        
        mobileContainer.innerHTML = html || '<p class="text-muted text-center">No data</p>';
    }
    
    renderAnalyticsCharts(filteredOrders) {
        const ctx = document.getElementById('revenueProfitChart');
        if (ctx && filteredOrders.length > 0) {
            if (this.revenueProfitChart) {
                this.revenueProfitChart.destroy();
            }
            
            const revenue = filteredOrders.reduce((sum, order) => sum + order.total, 0);
            const profit = filteredOrders.reduce((sum, order) => sum + (order.totalProfit || 0), 0);
            
            this.revenueProfitChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Revenue', 'Profit'],
                    datasets: [{
                        label: 'Amount (₹)',
                        data: [revenue, profit],
                        backgroundColor: ['#ff6b35', '#28a745']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return '₹' + value;
                                }
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return context.dataset.label + ': ₹' + context.raw.toFixed(2);
                                }
                            }
                        }
                    }
                }
            });
        }
        
        // Update mobile charts
        if (window.innerWidth <= 768) {
            this.updateMobileCharts(filteredOrders);
        }
    }
    
    updateMobileCharts(filteredOrders) {
        const mobileContainer = document.getElementById('mobile-charts');
        if (!mobileContainer) return;
        
        const revenue = filteredOrders.reduce((sum, order) => sum + order.total, 0);
        const profit = filteredOrders.reduce((sum, order) => sum + (order.totalProfit || 0), 0);
        const ordersCount = filteredOrders.length;
        
        let html = `
            <div class="chart-card-mobile">
                <div class="chart-title-mobile">Revenue vs Profit</div>
                <div class="chart-container-mobile">
                    <canvas id="mobile-revenue-profit-chart"></canvas>
                </div>
                <div class="d-flex justify-content-around mt-3">
                    <div>
                        <div class="chart-value-mobile chart-revenue">₹${revenue.toFixed(2)}</div>
                        <div class="text-muted">Revenue</div>
                    </div>
                    <div>
                        <div class="chart-value-mobile chart-profit">₹${profit.toFixed(2)}</div>
                        <div class="text-muted">Profit</div>
                    </div>
                </div>
            </div>
            
            <div class="chart-card-mobile">
                <div class="chart-title-mobile">Orders Overview</div>
                <div class="text-center py-3">
                    <div class="display-4 text-primary">${ordersCount}</div>
                    <div class="text-muted">Total Orders</div>
                </div>
                <div class="mt-3">
                    <div class="progress" style="height: 20px;">
                        <div class="progress-bar bg-success" style="width: ${ordersCount > 0 ? '100%' : '0%'}">
                            ${ordersCount} orders
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        mobileContainer.innerHTML = html;
        
        // Create mobile chart
        const mobileCtx = document.getElementById('mobile-revenue-profit-chart');
        if (mobileCtx && filteredOrders.length > 0) {
            new Chart(mobileCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Revenue', 'Profit'],
                    datasets: [{
                        data: [revenue, profit],
                        backgroundColor: ['#ff6b35', '#28a745'],
                        borderWidth: 2,
                        borderColor: '#fff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        }
    }
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.restaurantSystem = new RestaurantOrderSystem();
    });
} else {
    window.restaurantSystem = new RestaurantOrderSystem();
}
