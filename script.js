// Restaurant Order Management System with Firebase
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
        this.initAuth();
        this.initEventListeners();
        this.renderMenu();
        this.updateSummary();
        this.updateStats();
        this.updateBadges();
        this.updateNextOrderNumber();
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
    
    // Load business data from Firestore
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
            
            // Load ongoing orders
            const ordersSnapshot = await this.db.collection('businesses')
                .doc(this.businessId)
                .collection('orders')
                .where('status', 'in', ['preparing', 'ready'])
                .orderBy('orderTime', 'desc')
                .get();
            
            this.orders = ordersSnapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data(),
                orderNumber: doc.data().orderNumber || 0
            }));
            
            // Load completed orders
            const completedSnapshot = await this.db.collection('businesses')
                .doc(this.businessId)
                .collection('orders')
                .where('status', '==', 'completed')
                .orderBy('completedTime', 'desc')
                .limit(50)
                .get();
            
            this.completedOrders = completedSnapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data(),
                orderNumber: doc.data().orderNumber || 0
            }));
            
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
            this.showNotification('Error loading business data', 'error');
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
    
    // Create or update business profile
    async saveBusinessProfile(profileData) {
        try {
            if (!this.businessId) {
                // Create new business
                const businessRef = await this.db.collection('businesses').add({
                    ...profileData,
                    ownerId: this.currentUser.uid,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    categories: this.getDefaultCategories(),
                    nextOrderId: 1001
                });
                
                this.businessId = businessRef.id;
                
                // Update user document with business ID
                await this.db.collection('users').doc(this.currentUser.uid).update({
                    businessId: this.businessId,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                this.userData.businessId = this.businessId;
            } else {
                // Update existing business
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
    }
    
    // Save menu item to Firestore
    async saveMenuItemToFirestore(item) {
        if (!this.businessId) return item;
        
        try {
            const itemData = {
                name: item.name,
                category: item.category,
                price: item.price,
                cost: item.cost || 0,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            if (item.id && item.id.toString().length < 10) {
                // Update existing item
                await this.db.collection('businesses')
                    .doc(this.businessId)
                    .collection('menu')
                    .doc(item.id.toString())
                    .update(itemData);
                return item;
            } else {
                // Add new item
                itemData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                const docRef = await this.db.collection('businesses')
                    .doc(this.businessId)
                    .collection('menu')
                    .add(itemData);
                
                return { id: docRef.id, ...itemData };
            }
        } catch (error) {
            console.error('Error saving menu item:', error);
            throw error;
        }
    }
    
    // Delete menu item from Firestore
    async deleteMenuItemFromFirestore(itemId) {
        if (!this.businessId) return;
        
        try {
            await this.db.collection('businesses')
                .doc(this.businessId)
                .collection('menu')
                .doc(itemId.toString())
                .delete();
        } catch (error) {
            console.error('Error deleting menu item:', error);
            throw error;
        }
    }
    
    // Save order to Firestore
    async saveOrderToFirestore(order) {
        if (!this.businessId) return order;
        
        try {
            const orderData = {
                ...order,
                businessId: this.businessId,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            const orderRef = await this.db.collection('businesses')
                .doc(this.businessId)
                .collection('orders')
                .add(orderData);
            
            // Update next order ID
            await this.db.collection('businesses').doc(this.businessId).update({
                nextOrderId: this.nextOrderId + 1,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            return { id: orderRef.id, ...orderData };
        } catch (error) {
            console.error('Error saving order:', error);
            throw error;
        }
    }
    
    // Update order in Firestore
    async updateOrderInFirestore(orderId, updates) {
        if (!this.businessId) return;
        
        try {
            await this.db.collection('businesses')
                .doc(this.businessId)
                .collection('orders')
                .doc(orderId)
                .update({
                    ...updates,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
        } catch (error) {
            console.error('Error updating order:', error);
            throw error;
        }
    }
    
    // Delete order from Firestore
    async deleteOrderFromFirestore(orderId) {
        if (!this.businessId) return;
        
        try {
            await this.db.collection('businesses')
                .doc(this.businessId)
                .collection('orders')
                .doc(orderId)
                .delete();
        } catch (error) {
            console.error('Error deleting order:', error);
            throw error;
        }
    }
    
    // Initialize event listeners
    initEventListeners() {
        // Tab navigation
        document.querySelectorAll('.nav-link').forEach(element => {
            element.addEventListener('click', (e) => {
                e.preventDefault();
                const tabId = element.getAttribute('data-tab');
                this.switchTab(tabId);
                
                // Close navbar on mobile after clicking
                if (window.innerWidth <= 991) {
                    const navbarCollapse = document.getElementById('navbarNav');
                    if (navbarCollapse.classList.contains('show')) {
                        const bsCollapse = new bootstrap.Collapse(navbarCollapse, {
                            toggle: false
                        });
                        bsCollapse.hide();
                    }
                }
            });
        });
        
        // Customer info
        document.getElementById('customer-name').addEventListener('input', (e) => {
            this.currentOrder.customerName = e.target.value;
            this.updateSummary();
        });
        
        document.getElementById('customer-phone').addEventListener('input', (e) => {
            this.currentOrder.customerPhone = e.target.value;
        });
        
        document.getElementById('order-type').addEventListener('change', (e) => {
            this.currentOrder.orderType = e.target.value;
            this.updateSummary();
        });
        
        document.getElementById('payment-method').addEventListener('change', (e) => {
            this.currentOrder.paymentMethod = e.target.value;
            this.updateSummary();
        });
        
        // Menu search
        document.getElementById('menu-search').addEventListener('input', (e) => {
            this.renderMenu(e.target.value.toLowerCase());
        });
        
        // Action buttons
        document.getElementById('clear-order-btn').addEventListener('click', () => this.clearCurrentOrder());
        document.getElementById('place-order-btn').addEventListener('click', () => this.placeOrder());
        
        // Quick action buttons
        document.getElementById('quick-drinks').addEventListener('click', () => this.showCategory('DRINKS'));
        document.getElementById('quick-desserts').addEventListener('click', () => this.showCategory('DESSERTS'));
        document.getElementById('quick-appetizers').addEventListener('click', () => this.showCategory('APPETIZERS'));
        document.getElementById('quick-wraps').addEventListener('click', () => this.showCategory('WRAPS'));
        
        // Refresh orders
        document.getElementById('refresh-orders-btn').addEventListener('click', () => this.renderOngoingOrders());
        
        // Print all
        document.getElementById('print-all-btn').addEventListener('click', () => this.printAllOrders());
        
        // Download PDF
        document.getElementById('download-pdf-btn').addEventListener('click', () => this.downloadPDFReport());
        
        // Clear completed
        document.getElementById('clear-completed-btn').addEventListener('click', () => this.clearCompletedOrders());
        
        // Date filter
        document.getElementById('date-filter').addEventListener('change', () => this.renderCompletedOrders());
        
        // Analytics period filter
        document.getElementById('analytics-period').addEventListener('change', () => this.updateAnalytics());
        
        // Menu management
        document.getElementById('menu-item-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveMenuItem();
        });
        
        document.getElementById('cancel-edit-btn').addEventListener('click', () => this.cancelEditMenuItem());
        document.getElementById('add-category-btn').addEventListener('click', () => this.showNewCategoryInput());
        document.getElementById('new-category-btn').addEventListener('click', () => this.showNewCategoryInput());
        document.getElementById('save-category-btn').addEventListener('click', () => this.saveNewCategory());
        document.getElementById('cancel-category-btn').addEventListener('click', () => this.hideNewCategoryInput());
        
        // Complete order in modal
        document.getElementById('complete-order-btn').addEventListener('click', () => {
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
    
    // Switch between tabs
    switchTab(tabId) {
        // Update active tab in nav
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('data-tab') === tabId) {
                link.classList.add('active');
            }
        });
        
        // Show selected tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
            if (content.id === tabId) {
                content.classList.add('active');
            }
        });
        
        // Scroll to top on mobile
        if (window.innerWidth <= 768) {
            window.scrollTo(0, 0);
        }
        
        // Update content if needed
        if (tabId === 'ongoing-orders') {
            this.renderOngoingOrders();
        } else if (tabId === 'completed-orders') {
            this.renderCompletedOrders();
        } else if (tabId === 'menu-management') {
            this.renderMenuManagement();
        } else if (tabId === 'analytics') {
            this.updateAnalytics();
        } else if (tabId === 'profile') {
            this.updateProfileTab();
        }
    }
    
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
    
    // Update stats
    updateStats() {
        // Today's date
        const today = new Date().toISOString().split('T')[0];
        
        // Filter today's completed orders
        const todayOrders = this.completedOrders.filter(order => 
            order.completedTime && order.completedTime.startsWith(today)
        );
        
        // Calculate stats
        const todayRevenue = todayOrders.reduce((sum, order) => sum + order.total, 0);
        const todayItems = todayOrders.reduce((sum, order) => 
            sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
        
        // Update display
        const todayOrdersEl = document.getElementById('today-orders');
        const todayRevenueEl = document.getElementById('today-revenue');
        const todayItemsEl = document.getElementById('today-items');
        
        if (todayOrdersEl) todayOrdersEl.textContent = todayOrders.length;
        if (todayRevenueEl) todayRevenueEl.textContent = `₹${todayRevenue}`;
        if (todayItemsEl) todayItemsEl.textContent = todayItems;
    }
    
    // Update badges
    updateBadges() {
        const ongoingBadge = document.getElementById('ongoing-badge');
        const completedBadge = document.getElementById('completed-badge');
        
        if (ongoingBadge) ongoingBadge.textContent = this.orders.length;
        if (completedBadge) completedBadge.textContent = this.completedOrders.length;
    }
    
    // Update next order number
    updateNextOrderNumber() {
        const nextOrderNumber = document.getElementById('next-order-number');
        if (nextOrderNumber) {
            nextOrderNumber.textContent = this.nextOrderId;
        }
    }
    
    // Place new order
    async placeOrder() {
        if (this.currentOrder.items.length === 0) {
            this.showNotification('Please add items to the order', 'error');
            return;
        }
        
        // Calculate totals
        const total = this.currentOrder.items.reduce((sum, item) => sum + item.total, 0);
        const totalCost = this.currentOrder.items.reduce((sum, item) => 
            sum + (item.totalCost || (item.quantity * item.cost)), 0);
        const totalProfit = total - totalCost;
        
        // Create order
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
                total: item.total
            })),
            total: total,
            totalCost: totalCost,
            totalProfit: totalProfit,
            orderTime: new Date().toISOString(),
            status: 'preparing',
            orderNumber: this.nextOrderId
        };
        
        try {
            // Save to Firestore
            const savedOrder = await this.saveOrderToFirestore(order);
            
            // Add to local orders array
            this.orders.unshift(savedOrder);
            
            // Increment next order ID
            this.nextOrderId++;
            
            // Save to local storage as backup
            this.saveData('nextOrderId', this.nextOrderId);
            this.saveData('orders', this.orders);
            
            // Clear current order
            this.clearCurrentOrder();
            
            // Update UI
            this.updateBadges();
            this.updateStats();
            this.updateNextOrderNumber();
            
            // Show success message
            this.showNotification(`Order #${order.orderNumber} placed successfully!`, 'success');
            
            // Switch to ongoing orders tab
            this.switchTab('ongoing-orders');
            
        } catch (error) {
            console.error('Error placing order:', error);
            this.showNotification('Error placing order: ' + error.message, 'error');
        }
    }
    
    // Clear current order
    clearCurrentOrder() {
        this.currentOrder = {
            items: [],
            customerName: '',
            customerPhone: '',
            orderType: 'dine-in',
            paymentMethod: 'cash',
            notes: ''
        };
        
        // Reset form
        const customerName = document.getElementById('customer-name');
        const customerPhone = document.getElementById('customer-phone');
        const orderType = document.getElementById('order-type');
        const paymentMethod = document.getElementById('payment-method');
        
        if (customerName) customerName.value = '';
        if (customerPhone) customerPhone.value = '';
        if (orderType) orderType.value = 'dine-in';
        if (paymentMethod) paymentMethod.value = 'cash';
        
        // Reset all quantity inputs
        this.menu.forEach(item => {
            const input = document.getElementById(`qty-${item.id}`);
            if (input) input.value = 0;
            
            const menuCard = document.querySelector(`.menu-item-card[data-item-id="${item.id}"]`);
            if (menuCard) menuCard.classList.remove('selected');
        });
        
        // Update UI
        this.updateSelectedItemsTable();
        this.updateSummary();
    }
    
    // Show category
    showCategory(category) {
        const element = document.querySelector(`#category-${category.replace(/\s+/g, '-')}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    }
    
    // Render ongoing orders
    renderOngoingOrders() {
        const tbody = document.getElementById('ongoing-orders-body');
        const emptyState = document.getElementById('no-ongoing-orders');
        
        if (!tbody || !emptyState) return;
        
        if (this.orders.length === 0) {
            tbody.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }
        
        emptyState.style.display = 'none';
        let html = '';
        
        this.orders.forEach(order => {
            const orderTime = new Date(order.orderTime);
            const itemsCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
            const itemsText = order.items.slice(0, 2).map(item => `${item.name} (x${item.quantity})`).join(', ');
            const moreItems = order.items.length > 2 ? ` +${order.items.length - 2} more` : '';
            
            html += `
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
                    <td>₹${order.total}</td>
                    <td>
                        <span class="status-badge status-${order.status}">
                            ${order.status}
                        </span>
                    </td>
                    <td>
                        <div class="d-flex gap-2">
                            <button class="btn btn-sm btn-outline-primary view-order-btn" data-order-id="${order.id}" title="View Order">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-sm btn-success complete-order-btn" data-order-id="${order.id}" title="Complete Order">
                                <i class="fas fa-check me-1"></i> Complete
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
        
        // Add event listeners
        document.querySelectorAll('.view-order-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const orderId = e.currentTarget.getAttribute('data-order-id');
                this.viewOrderDetails(orderId);
            });
        });
        
        document.querySelectorAll('.complete-order-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const orderId = e.currentTarget.getAttribute('data-order-id');
                this.completeOrder(orderId);
            });
        });
        
        document.querySelectorAll('.delete-order-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const orderId = e.currentTarget.getAttribute('data-order-id');
                this.deleteOrder(orderId);
            });
        });
    }
    
    // View order details
    viewOrderDetails(orderId) {
        const order = this.orders.find(o => o.id == orderId) || 
                     this.completedOrders.find(o => o.id == orderId);
        
        if (!order) return;
        
        // Populate modal
        document.getElementById('modal-order-no').textContent = order.orderNumber || order.id;
        document.getElementById('modal-customer').textContent = order.customerName || 'Walk-in';
        document.getElementById('modal-phone').textContent = order.customerPhone || 'N/A';
        document.getElementById('modal-order-time').textContent = new Date(order.orderTime).toLocaleString();
        document.getElementById('modal-order-type').textContent = order.orderType;
        
        // Populate items
        let itemsHtml = '';
        order.items.forEach(item => {
            itemsHtml += `
                <tr>
                    <td>${item.name}</td>
                    <td>${item.quantity}</td>
                    <td>₹${item.price}</td>
                    <td>₹${item.total}</td>
                </tr>
            `;
        });
        
        document.getElementById('modal-items-body').innerHTML = itemsHtml;
        document.getElementById('modal-total').textContent = order.total;
        
        // Set order id on complete button
        const completeBtn = document.getElementById('complete-order-btn');
        completeBtn.setAttribute('data-order-id', order.id);
        
        // Show/hide complete button based on order status
        if (order.status === 'completed') {
            completeBtn.style.display = 'none';
        } else {
            completeBtn.style.display = 'inline-block';
        }
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('orderDetailsModal'));
        modal.show();
    }
    
    // Complete order
    async completeOrder(orderId) {
        const orderIndex = this.orders.findIndex(o => o.id == orderId);
        if (orderIndex === -1) return;
        
        try {
            // Remove from ongoing orders array
            const [completedOrder] = this.orders.splice(orderIndex, 1);
            
            // Update order in Firestore
            await this.updateOrderInFirestore(orderId, {
                status: 'completed',
                completedTime: new Date().toISOString()
            });
            
            // Update local order
            completedOrder.status = 'completed';
            completedOrder.completedTime = new Date().toISOString();
            
            // Add to completed orders array
            this.completedOrders.unshift(completedOrder);
            
            // Update local storage
            this.saveData('orders', this.orders);
            this.saveData('completedOrders', this.completedOrders);
            
            // Update UI
            this.renderOngoingOrders();
            this.renderCompletedOrders();
            this.updateBadges();
            this.updateStats();
            
            // Update analytics if on analytics tab
            const currentTab = document.querySelector('.tab-content.active');
            if (currentTab && currentTab.id === 'analytics') {
                this.updateAnalytics();
            }
            
            // Show success
            this.showNotification(`Order #${completedOrder.orderNumber || completedOrder.id} completed!`, 'success');
            
            // Close modal if open
            const modal = bootstrap.Modal.getInstance(document.getElementById('orderDetailsModal'));
            if (modal) modal.hide();
            
        } catch (error) {
            console.error('Error completing order:', error);
            this.showNotification('Error completing order: ' + error.message, 'error');
        }
    }
    
    // Delete order
    async deleteOrder(orderId) {
        if (!confirm('Are you sure you want to delete this order?')) {
            return;
        }
        
        const orderIndex = this.orders.findIndex(o => o.id == orderId);
        if (orderIndex === -1) return;
        
        try {
            // Delete from Firestore
            await this.deleteOrderFromFirestore(orderId);
            
            // Remove from local array
            this.orders.splice(orderIndex, 1);
            
            // Update local storage
            this.saveData('orders', this.orders);
            
            // Update UI
            this.renderOngoingOrders();
            this.updateBadges();
            
            this.showNotification('Order deleted', 'success');
            
        } catch (error) {
            console.error('Error deleting order:', error);
            this.showNotification('Error deleting order: ' + error.message, 'error');
        }
    }
    
    // Print all orders
    printAllOrders() {
        window.print();
    }
    
    // Render completed orders
    renderCompletedOrders() {
        const tbody = document.getElementById('completed-orders-body');
        const emptyState = document.getElementById('no-completed-orders');
        const dateFilter = document.getElementById('date-filter');
        
        if (!tbody || !emptyState || !dateFilter) return;
        
        // Filter orders
        let filteredOrders = this.completedOrders;
        const filterValue = dateFilter.value;
        const now = new Date();
        
        switch(filterValue) {
            case 'today':
                const today = now.toISOString().split('T')[0];
                filteredOrders = this.completedOrders.filter(order => 
                    order.completedTime && order.completedTime.startsWith(today)
                );
                break;
            case 'yesterday':
                const yesterday = new Date(now.setDate(now.getDate() - 1)).toISOString().split('T')[0];
                filteredOrders = this.completedOrders.filter(order => 
                    order.completedTime && order.completedTime.startsWith(yesterday)
                );
                break;
            case 'week':
                const weekAgo = new Date(now.setDate(now.getDate() - 7)).toISOString().split('T')[0];
                filteredOrders = this.completedOrders.filter(order => 
                    order.completedTime && order.completedTime >= weekAgo
                );
                break;
            case 'month':
                const monthAgo = new Date(now.setMonth(now.getMonth() - 1)).toISOString().split('T')[0];
                filteredOrders = this.completedOrders.filter(order => 
                    order.completedTime && order.completedTime >= monthAgo
                );
                break;
            // 'all' uses all orders
        }
        
        if (filteredOrders.length === 0) {
            tbody.innerHTML = '';
            emptyState.style.display = 'block';
            this.updateSalesSummary([]);
            return;
        }
        
        emptyState.style.display = 'none';
        let html = '';
        
        filteredOrders.forEach(order => {
            const orderTime = new Date(order.orderTime);
            const completedTime = new Date(order.completedTime);
            const itemsCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
            const profit = order.totalProfit || (order.total - (order.totalCost || 0));
            const profitClass = profit >= 0 ? 'profit-positive' : 'profit-negative';
            
            html += `
                <tr>
                    <td><strong>#${order.orderNumber || order.id}</strong></td>
                    <td>${orderTime.toLocaleDateString()}</td>
                    <td>${order.customerName || 'Walk-in'}</td>
                    <td>${itemsCount} items</td>
                    <td>₹${order.total}</td>
                    <td class="${profitClass}">₹${profit}</td>
                    <td>${completedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
        
        // Update sales summary
        this.updateSalesSummary(filteredOrders);
    }
    
    // Update sales summary
    updateSalesSummary(orders) {
        // Calculate totals
        const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
        const totalCost = orders.reduce((sum, order) => sum + (order.totalCost || 0), 0);
        const totalProfit = totalRevenue - totalCost;
        const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0;
        const totalOrders = orders.length;
        
        const totalRevenueEl = document.getElementById('total-revenue');
        const totalOrdersEl = document.getElementById('total-orders');
        const totalProfitEl = document.getElementById('total-profit');
        const profitMarginEl = document.getElementById('profit-margin');
        
        if (totalRevenueEl) totalRevenueEl.textContent = `₹${totalRevenue}`;
        if (totalOrdersEl) totalOrdersEl.textContent = totalOrders;
        if (totalProfitEl) totalProfitEl.textContent = `₹${totalProfit}`;
        if (profitMarginEl) profitMarginEl.textContent = `${profitMargin}%`;
        
        // Calculate item-wise sales
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
                const itemProfit = (item.price - itemCost) * item.quantity;
                
                itemSales[item.name].quantity += item.quantity;
                itemSales[item.name].revenue += item.total;
                itemSales[item.name].cost += itemCost * item.quantity;
                itemSales[item.name].profit += itemProfit;
            });
        });
        
        // Update top items table
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
                    <td>₹${data.revenue}</td>
                    <td class="${profitClass}">₹${data.profit}</td>
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
    
    // Download PDF report
    downloadPDFReport() {
        if (this.completedOrders.length === 0) {
            this.showNotification('No completed orders to generate report', 'error');
            return;
        }
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Add title
        doc.setFontSize(20);
        doc.setTextColor(40, 40, 40);
        doc.text('Restaurant Sales Report', 105, 20, { align: 'center' });
        
        // Add date
        doc.setFontSize(12);
        doc.setTextColor(100, 100, 100);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 105, 30, { align: 'center' });
        
        // Add summary
        const totalRevenue = this.completedOrders.reduce((sum, order) => sum + order.total, 0);
        const totalCost = this.completedOrders.reduce((sum, order) => sum + (order.totalCost || 0), 0);
        const totalProfit = totalRevenue - totalCost;
        const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) : 0;
        const totalOrders = this.completedOrders.length;
        
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text('Summary', 20, 45);
        
        doc.setFontSize(11);
        doc.text(`Total Orders: ${totalOrders}`, 20, 55);
        doc.text(`Total Revenue: ₹${totalRevenue}`, 20, 62);
        doc.text(`Total Cost: ₹${totalCost}`, 20, 69);
        doc.text(`Total Profit: ₹${totalProfit}`, 20, 76);
        doc.text(`Profit Margin: ${profitMargin}%`, 20, 83);
        
        // Calculate item-wise sales
        const itemSales = {};
        this.completedOrders.forEach(order => {
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
                const itemProfit = (item.price - itemCost) * item.quantity;
                
                itemSales[item.name].quantity += item.quantity;
                itemSales[item.name].revenue += item.total;
                itemSales[item.name].cost += itemCost * item.quantity;
                itemSales[item.name].profit += itemProfit;
            });
        });
        
        // Prepare table data for item-wise sales with profit
        const tableData = Object.entries(itemSales).map(([itemName, data], index) => {
            const margin = data.revenue > 0 ? ((data.profit / data.revenue) * 100).toFixed(1) : 0;
            return [
                index + 1,
                itemName,
                data.quantity,
                `₹${data.revenue}`,
                `₹${data.cost}`,
                `₹${data.profit}`,
                `${margin}%`
            ];
        });
        
        // Add item-wise sales table with profit
        doc.autoTable({
            head: [['#', 'Item Name', 'Qty', 'Revenue', 'Cost', 'Profit', 'Margin']],
            body: tableData,
            startY: 90,
            theme: 'grid',
            headStyles: { fillColor: [255, 107, 53] }
        });
        
        // Add recent orders table
        const recentOrders = this.completedOrders.slice(0, 10);
        const recentOrdersData = recentOrders.map((order, index) => {
            const profit = order.totalProfit || (order.total - (order.totalCost || 0));
            const margin = order.total > 0 ? ((profit / order.total) * 100).toFixed(1) : 0;
            return [
                order.orderNumber || order.id,
                new Date(order.orderTime).toLocaleDateString(),
                order.items.reduce((sum, item) => sum + item.quantity, 0),
                `₹${order.total}`,
                `₹${profit}`,
                `${margin}%`
            ];
        });
        
        doc.addPage();
        doc.setFontSize(14);
        doc.text('Recent Orders with Profit', 20, 20);
        
        doc.autoTable({
            head: [['Order #', 'Date', 'Items', 'Total', 'Profit', 'Margin']],
            body: recentOrdersData,
            startY: 30,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185] }
        });
        
        // Add profit trend analysis
        doc.addPage();
        doc.setFontSize(14);
        doc.text('Profit Analysis by Category', 20, 20);
        
        // Calculate profit by category
        const categoryProfit = {};
        this.completedOrders.forEach(order => {
            order.items.forEach(item => {
                const menuItem = this.menu.find(m => m.id === item.id);
                if (menuItem) {
                    const category = menuItem.category;
                    if (!categoryProfit[category]) {
                        categoryProfit[category] = {
                            revenue: 0,
                            cost: 0,
                            profit: 0,
                            items: 0
                        };
                    }
                    const itemProfit = (item.price - (item.cost || menuItem.cost || 0)) * item.quantity;
                    
                    categoryProfit[category].revenue += item.total;
                    categoryProfit[category].cost += (item.cost || menuItem.cost || 0) * item.quantity;
                    categoryProfit[category].profit += itemProfit;
                    categoryProfit[category].items += item.quantity;
                }
            });
        });
        
        const categoryData = Object.entries(categoryProfit).map(([category, data], index) => {
            const margin = data.revenue > 0 ? ((data.profit / data.revenue) * 100).toFixed(1) : 0;
            return [
                index + 1,
                category,
                data.items,
                `₹${data.revenue}`,
                `₹${data.cost}`,
                `₹${data.profit}`,
                `${margin}%`
            ];
        });
        
        doc.autoTable({
            head: [['#', 'Category', 'Items', 'Revenue', 'Cost', 'Profit', 'Margin']],
            body: categoryData,
            startY: 30,
            theme: 'grid',
            headStyles: { fillColor: [102, 51, 153] }
        });
        
        // Save PDF
        doc.save(`sales-profit-report-${new Date().toISOString().split('T')[0]}.pdf`);
        
        this.showNotification('PDF report with profit analysis downloaded!', 'success');
    }
    
    // Clear completed orders
    async clearCompletedOrders() {
        if (this.completedOrders.length === 0) {
            this.showNotification('No completed orders to clear', 'error');
            return;
        }
        
        if (confirm('Are you sure you want to clear all completed orders? This action cannot be undone.')) {
            try {
                // Delete from Firestore
                for (const order of this.completedOrders) {
                    await this.deleteOrderFromFirestore(order.id);
                }
                
                // Clear local array
                this.completedOrders = [];
                
                // Update local storage
                this.saveData('completedOrders', this.completedOrders);
                
                // Update UI
                this.renderCompletedOrders();
                this.updateBadges();
                
                this.showNotification('All completed orders cleared', 'success');
            } catch (error) {
                console.error('Error clearing completed orders:', error);
                this.showNotification('Error clearing completed orders', 'error');
            }
        }
    }
    
    // Update analytics
    updateAnalytics() {
        const period = document.getElementById('analytics-period');
        if (!period) return;
        
        const periodValue = period.value;
        let filteredOrders = this.completedOrders;
        
        // Filter orders based on period
        const now = new Date();
        switch(periodValue) {
            case 'today':
                const today = now.toISOString().split('T')[0];
                filteredOrders = this.completedOrders.filter(order => 
                    order.completedTime && order.completedTime.startsWith(today)
                );
                break;
            case 'week':
                const weekAgo = new Date(now.setDate(now.getDate() - 7)).toISOString().split('T')[0];
                filteredOrders = this.completedOrders.filter(order => 
                    order.completedTime && order.completedTime >= weekAgo
                );
                break;
            case 'month':
                const monthAgo = new Date(now.setMonth(now.getMonth() - 1)).toISOString().split('T')[0];
                filteredOrders = this.completedOrders.filter(order => 
                    order.completedTime && order.completedTime >= monthAgo
                );
                break;
            // 'all' uses all orders
        }
        
        this.renderAnalyticsCharts(filteredOrders);
        this.updateAnalyticsSummary(filteredOrders);
        this.renderBestItems(filteredOrders);
        this.renderCategoryPerformance(filteredOrders);
        this.renderCategoryItemCharts(filteredOrders);
    }
    
    // Render analytics charts
    renderAnalyticsCharts(orders) {
        // Destroy existing charts if they exist
        if (this.revenueProfitChart) {
            this.revenueProfitChart.destroy();
        }
        if (this.categoryRevenueChart) {
            this.categoryRevenueChart.destroy();
        }
        if (this.categoryProfitChart) {
            this.categoryProfitChart.destroy();
        }
        if (this.topItemsRevenueChart) {
            this.topItemsRevenueChart.destroy();
        }
        
        // Calculate category-wise data
        const categoryData = this.calculateCategoryData(orders);
        const categories = Object.keys(categoryData);
        
        // Prepare data for charts
        const categoryRevenueData = categories.map(cat => categoryData[cat].revenue);
        const categoryProfitData = categories.map(cat => categoryData[cat].profit);
        
        // Calculate item-wise data for top items
        const itemData = this.calculateItemData(orders);
        const topItems = Object.entries(itemData)
            .sort((a, b) => b[1].revenue - a[1].revenue)
            .slice(0, 8);
        
        const topItemNames = topItems.map(([name]) => name);
        const topItemRevenue = topItems.map(([, data]) => data.revenue);
        const topItemProfit = topItems.map(([, data]) => data.profit);
        
        // Enhanced color palette
        const colors = {
            revenue: '#3498db',
            profit: '#2ecc71',
            categoryColors: [
                '#e74c3c',
                '#3498db',
                '#f39c12',
                '#2ecc71',
                '#9b59b6'
            ],
            lightColors: [
                'rgba(231, 76, 60, 0.8)',
                'rgba(52, 152, 219, 0.8)',
                'rgba(243, 156, 18, 0.8)',
                'rgba(46, 204, 113, 0.8)',
                'rgba(155, 89, 182, 0.8)'
            ]
        };
        
        // 1. Revenue vs Profit Chart
        const revenueProfitCtx = document.getElementById('revenueProfitChart');
        if (revenueProfitCtx) {
            this.revenueProfitChart = new Chart(revenueProfitCtx.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: ['Revenue', 'Profit'],
                    datasets: [{
                        label: 'Amount (₹)',
                        data: [
                            orders.reduce((sum, order) => sum + order.total, 0),
                            orders.reduce((sum, order) => sum + (order.totalProfit || (order.total - (order.totalCost || 0))), 0)
                        ],
                        backgroundColor: [colors.revenue, colors.profit],
                        borderColor: [colors.revenue, colors.profit],
                        borderWidth: 2,
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Overall Revenue vs Profit',
                            font: { size: 16, weight: 'bold' },
                            color: '#2c3e50'
                        },
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(0,0,0,0.05)' },
                            ticks: {
                                callback: function(value) {
                                    return '₹' + value.toLocaleString();
                                }
                            }
                        },
                        x: { grid: { display: false } }
                    }
                }
            });
        }
        
        // 2. Category-wise Revenue Chart
        const categoryRevenueCtx = document.getElementById('categoryRevenueChart');
        if (categoryRevenueCtx) {
            this.categoryRevenueChart = new Chart(categoryRevenueCtx.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: categories,
                    datasets: [{
                        data: categoryRevenueData,
                        backgroundColor: colors.lightColors.slice(0, categories.length),
                        borderColor: colors.categoryColors.slice(0, categories.length),
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '60%',
                    plugins: {
                        title: {
                            display: true,
                            text: 'Revenue by Category',
                            font: { size: 16, weight: 'bold' },
                            color: '#2c3e50'
                        }
                    }
                }
            });
        }
        
        // 3. Category-wise Profit Chart
        const categoryProfitCtx = document.getElementById('categoryProfitChart');
        if (categoryProfitCtx) {
            this.categoryProfitChart = new Chart(categoryProfitCtx.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: categories,
                    datasets: [{
                        label: 'Profit (₹)',
                        data: categoryProfitData,
                        backgroundColor: colors.lightColors.slice(0, categories.length),
                        borderColor: colors.categoryColors.slice(0, categories.length),
                        borderWidth: 2,
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Profit by Category',
                            font: { size: 16, weight: 'bold' },
                            color: '#2c3e50'
                        },
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(0,0,0,0.05)' },
                            ticks: {
                                callback: function(value) {
                                    return '₹' + value.toLocaleString();
                                }
                            }
                        },
                        x: { grid: { display: false } }
                    }
                }
            });
        }
        
        // 4. Top Items Revenue Chart
        const topItemsCtx = document.getElementById('topItemsRevenueChart');
        if (topItemsCtx) {
            this.topItemsRevenueChart = new Chart(topItemsCtx.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: topItemNames.map(name => name.length > 15 ? name.substring(0, 15) + '...' : name),
                    datasets: [
                        {
                            label: 'Revenue',
                            data: topItemRevenue,
                            backgroundColor: colors.revenue,
                            borderColor: colors.revenue,
                            borderWidth: 2,
                            borderRadius: 4
                        },
                        {
                            label: 'Profit',
                            data: topItemProfit,
                            backgroundColor: colors.profit,
                            borderColor: colors.profit,
                            borderWidth: 2,
                            borderRadius: 4
                        }
                    ]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Top Items - Revenue vs Profit',
                            font: { size: 16, weight: 'bold' },
                            color: '#2c3e50'
                        }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            grid: { color: 'rgba(0,0,0,0.05)' },
                            ticks: {
                                callback: function(value) {
                                    return '₹' + value.toLocaleString();
                                }
                            }
                        },
                        y: { grid: { display: false } }
                    }
                }
            });
        }
    }
    
    // Render category item charts
    renderCategoryItemCharts(orders) {
        // Category-specific charts
        const categories = ['APPETIZERS', 'WRAPS', 'BURGERS', 'DESSERTS'];
        
        categories.forEach(category => {
            // Destroy existing chart if it exists
            if (this.categoryItemCharts[category]) {
                this.categoryItemCharts[category].destroy();
            }
            
            // Get canvas element
            const canvas = document.getElementById(`${category.toLowerCase()}Chart`);
            if (!canvas) return;
            
            // Get items for this category
            const categoryItems = this.menu.filter(item => item.category === category);
            
            // Calculate sales data for each item
            const itemSales = {};
            categoryItems.forEach(item => {
                itemSales[item.name] = {
                    revenue: 0,
                    profit: 0,
                    quantity: 0
                };
            });
            
            // Calculate totals from orders
            orders.forEach(order => {
                order.items.forEach(orderItem => {
                    const menuItem = this.menu.find(m => m.id === orderItem.id);
                    if (menuItem && menuItem.category === category) {
                        if (!itemSales[menuItem.name]) {
                            itemSales[menuItem.name] = {
                                revenue: 0,
                                profit: 0,
                                quantity: 0
                            };
                        }
                        
                        const itemRevenue = orderItem.price * orderItem.quantity;
                        const itemCost = (orderItem.cost || menuItem.cost || 0) * orderItem.quantity;
                        const itemProfit = itemRevenue - itemCost;
                        
                        itemSales[menuItem.name].revenue += itemRevenue;
                        itemSales[menuItem.name].profit += itemProfit;
                        itemSales[menuItem.name].quantity += orderItem.quantity;
                    }
                });
            });
            
            // Sort items by revenue and take top 5
            const sortedItems = Object.entries(itemSales)
                .filter(([, data]) => data.revenue > 0)
                .sort((a, b) => b[1].revenue - a[1].revenue)
                .slice(0, 5);
            
            const itemNames = sortedItems.map(([name]) => name);
            const itemRevenue = sortedItems.map(([, data]) => data.revenue);
            const itemProfit = sortedItems.map(([, data]) => data.profit);
            
            // Create chart
            this.categoryItemCharts[category] = new Chart(canvas.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: itemNames.map(name => name.length > 12 ? name.substring(0, 12) + '...' : name),
                    datasets: [
                        {
                            label: 'Revenue',
                            data: itemRevenue,
                            backgroundColor: '#3498db',
                            borderColor: '#3498db',
                            borderWidth: 2,
                            borderRadius: 4
                        },
                        {
                            label: 'Profit',
                            data: itemProfit,
                            backgroundColor: '#2ecc71',
                            borderColor: '#2ecc71',
                            borderWidth: 2,
                            borderRadius: 4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: `${category} Performance`,
                            font: { size: 14, weight: 'bold' },
                            color: '#2c3e50'
                        },
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(0,0,0,0.05)' },
                            ticks: {
                                callback: function(value) {
                                    return '₹' + value.toLocaleString();
                                }
                            }
                        },
                        x: { grid: { display: false } }
                    }
                }
            });
        });
    }
    
    // Calculate category data for charts
    calculateCategoryData(orders) {
        const categoryData = {};
        
        // Initialize with all categories
        this.categories.forEach(category => {
            categoryData[category] = {
                revenue: 0,
                profit: 0,
                itemsSold: 0
            };
        });
        
        // Calculate totals
        orders.forEach(order => {
            order.items.forEach(item => {
                const menuItem = this.menu.find(m => m.id === item.id);
                if (menuItem) {
                    const category = menuItem.category;
                    if (!categoryData[category]) {
                        categoryData[category] = {
                            revenue: 0,
                            profit: 0,
                            itemsSold: 0
                        };
                    }
                    
                    const itemRevenue = item.price * item.quantity;
                    const itemCost = (item.cost || menuItem.cost || 0) * item.quantity;
                    const itemProfit = itemRevenue - itemCost;
                    
                    categoryData[category].revenue += itemRevenue;
                    categoryData[category].profit += itemProfit;
                    categoryData[category].itemsSold += item.quantity;
                }
            });
        });
        
        return categoryData;
    }
    
    // Calculate item data for charts
    calculateItemData(orders) {
        const itemData = {};
        
        orders.forEach(order => {
            order.items.forEach(item => {
                if (!itemData[item.name]) {
                    itemData[item.name] = {
                        revenue: 0,
                        profit: 0,
                        quantity: 0
                    };
                }
                
                const menuItem = this.menu.find(m => m.id === item.id);
                const itemCost = (item.cost || (menuItem ? menuItem.cost : 0) || 0) * item.quantity;
                const itemRevenue = item.price * item.quantity;
                const itemProfit = itemRevenue - itemCost;
                
                itemData[item.name].revenue += itemRevenue;
                itemData[item.name].profit += itemProfit;
                itemData[item.name].quantity += item.quantity;
            });
        });
        
        return itemData;
    }
    
    // Update analytics summary
    updateAnalyticsSummary(orders) {
        // Calculate totals
        const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
        const totalCost = orders.reduce((sum, order) => sum + (order.totalCost || 0), 0);
        const totalProfit = totalRevenue - totalCost;
        const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0;
        const totalOrders = orders.length;
        
        // Update display
        const analyticsRevenue = document.getElementById('analytics-revenue');
        const analyticsProfit = document.getElementById('analytics-profit');
        const analyticsOrders = document.getElementById('analytics-orders');
        const analyticsMargin = document.getElementById('analytics-margin');
        
        if (analyticsRevenue) analyticsRevenue.textContent = `₹${totalRevenue.toLocaleString()}`;
        if (analyticsProfit) analyticsProfit.textContent = `₹${totalProfit.toLocaleString()}`;
        if (analyticsOrders) analyticsOrders.textContent = totalOrders;
        if (analyticsMargin) analyticsMargin.textContent = `${profitMargin}%`;
    }
    
    // Render best items table
    renderBestItems(orders) {
        const itemData = this.calculateItemData(orders);
        
        // Get top 5 items by revenue
        const topItems = Object.entries(itemData)
            .sort((a, b) => b[1].revenue - a[1].revenue)
            .slice(0, 5);
        
        let html = '';
        topItems.forEach(([itemName, data]) => {
            const profitClass = data.profit >= 0 ? 'profit-positive' : 'profit-negative';
            html += `
                <tr>
                    <td>${itemName}</td>
                    <td>${data.quantity}</td>
                    <td>₹${data.revenue.toLocaleString()}</td>
                    <td class="${profitClass}">₹${data.profit.toLocaleString()}</td>
                </tr>
            `;
        });
        
        const bestItemsBody = document.getElementById('best-items-body');
        if (bestItemsBody) {
            bestItemsBody.innerHTML = html || 
                '<tr><td colspan="4" class="text-center text-muted">No data</td></tr>';
        }
    }
    
    // Render category performance table
    renderCategoryPerformance(orders) {
        const categoryData = this.calculateCategoryData(orders);
        
        // Convert to array and sort by revenue
        const categoryArray = Object.entries(categoryData)
            .map(([category, data]) => ({
                category,
                ...data,
                margin: data.revenue > 0 ? ((data.profit / data.revenue) * 100).toFixed(1) : 0
            }))
            .sort((a, b) => b.revenue - a.revenue);
        
        let html = '';
        categoryArray.forEach(data => {
            const profitClass = data.profit >= 0 ? 'profit-positive' : 'profit-negative';
            html += `
                <tr>
                    <td>${data.category}</td>
                    <td>₹${data.revenue.toLocaleString()}</td>
                    <td class="${profitClass}">₹${data.profit.toLocaleString()}</td>
                    <td>${data.margin}%</td>
                </tr>
            `;
        });
        
        const categoryPerformanceBody = document.getElementById('category-performance-body');
        if (categoryPerformanceBody) {
            categoryPerformanceBody.innerHTML = html || 
                '<tr><td colspan="4" class="text-center text-muted">No data</td></tr>';
        }
    }
    
    // Render menu management
    renderMenuManagement() {
        const tbody = document.getElementById('menu-management-body');
        const categorySelect = document.getElementById('item-category');
        
        if (!tbody || !categorySelect) return;
        
        // Update category dropdown
        categorySelect.innerHTML = '<option value="">Select Category</option>';
        this.categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categorySelect.appendChild(option);
        });
        
        // Group items by category
        const categories = {};
        this.menu.forEach(item => {
            if (!categories[item.category]) {
                categories[item.category] = [];
            }
            categories[item.category].push(item);
        });
        
        let html = '';
        
        // Render each category
        this.categories.forEach(category => {
            // Category header
            html += `
                <tr class="table-secondary">
                    <td colspan="6" class="fw-bold">
                        ${category}
                        <button class="btn btn-sm btn-outline-danger float-end delete-category-btn" 
                                data-category="${category}">
                            <i class="fas fa-trash"></i> Delete Category
                        </button>
                    </td>
                </tr>
            `;
            
            // Category items
            const items = categories[category] || [];
            items.forEach((item, index) => {
                const profit = item.price - item.cost;
                const margin = item.price > 0 ? ((profit / item.price) * 100).toFixed(1) : 0;
                const profitClass = profit >= 0 ? 'profit-positive' : 'profit-negative';
                html += `
                    <tr>
                        <td></td>
                        <td>${item.name}</td>
                        <td>₹${item.cost}</td>
                        <td>₹${item.price}</td>
                        <td class="${profitClass}">
                            ₹${profit} (${margin}%)
                        </td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary edit-item-btn" 
                                    data-item-id="${item.id}">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger delete-item-btn" 
                                    data-item-id="${item.id}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
        });
        
        tbody.innerHTML = html;
        
        // Add event listeners
        document.querySelectorAll('.edit-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const itemId = e.currentTarget.getAttribute('data-item-id');
                this.editMenuItem(itemId);
            });
        });
        
        document.querySelectorAll('.delete-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const itemId = e.currentTarget.getAttribute('data-item-id');
                this.deleteMenuItem(itemId);
            });
        });
        
        document.querySelectorAll('.delete-category-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const category = e.currentTarget.getAttribute('data-category');
                this.deleteCategory(category);
            });
        });
    }
    
    // Edit menu item
    editMenuItem(itemId) {
        const item = this.menu.find(i => i.id === itemId);
        if (!item) return;
        
        // Populate form
        const itemCategory = document.getElementById('item-category');
        const itemName = document.getElementById('item-name');
        const itemPrice = document.getElementById('item-price');
        const itemCost = document.getElementById('item-cost');
        const editItemId = document.getElementById('edit-item-id');
        
        if (itemCategory) itemCategory.value = item.category;
        if (itemName) itemName.value = item.name;
        if (itemPrice) itemPrice.value = item.price;
        if (itemCost) itemCost.value = item.cost || 0;
        if (editItemId) editItemId.value = item.id;
        
        // Scroll to form
        if (itemName) itemName.focus();
    }
    
    // Save menu item
    async saveMenuItem() {
        const itemCategory = document.getElementById('item-category');
        const itemName = document.getElementById('item-name');
        const itemPrice = document.getElementById('item-price');
        const itemCost = document.getElementById('item-cost');
        const editItemId = document.getElementById('edit-item-id');
        
        if (!itemCategory || !itemName || !itemPrice || !itemCost || !editItemId) return;
        
        const category = itemCategory.value;
        const name = itemName.value.trim();
        const price = parseInt(itemPrice.value);
        const cost = parseInt(itemCost.value) || 0;
        const editItemIdValue = editItemId.value;
        
        if (!category || !name || !price || price <= 0) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }
        
        if (cost >= price) {
            if (!confirm('Cost is higher than or equal to price. This will result in zero or negative profit. Continue?')) {
                return;
            }
        }
        
        try {
            let menuItem;
            
            if (editItemIdValue) {
                // Update existing item
                const itemId = editItemIdValue;
                const itemIndex = this.menu.findIndex(i => i.id === itemId);
                
                if (itemIndex !== -1) {
                    menuItem = {
                        id: itemId,
                        category: category,
                        name: name,
                        price: price,
                        cost: cost
                    };
                    
                    this.menu[itemIndex] = menuItem;
                    await this.saveMenuItemToFirestore(menuItem);
                }
            } else {
                // Add new item
                menuItem = {
                    id: Date.now().toString(),
                    category: category,
                    name: name,
                    price: price,
                    cost: cost
                };
                
                const savedItem = await this.saveMenuItemToFirestore(menuItem);
                this.menu.push(savedItem);
            }
            
            // Save to local storage as backup
            this.saveData('menu', this.menu);
            
            // Reset form
            this.cancelEditMenuItem();
            
            // Update UI
            this.renderMenu();
            this.renderMenuManagement();
            
            this.showNotification('Menu item saved successfully!', 'success');
            
        } catch (error) {
            console.error('Error saving menu item:', error);
            this.showNotification('Error saving menu item: ' + error.message, 'error');
        }
    }
    
    // Cancel edit menu item
    cancelEditMenuItem() {
        const menuItemForm = document.getElementById('menu-item-form');
        const editItemId = document.getElementById('edit-item-id');
        
        if (menuItemForm) menuItemForm.reset();
        if (editItemId) editItemId.value = '';
    }
    
    // Delete menu item
    async deleteMenuItem(itemId) {
        if (!confirm('Are you sure you want to delete this menu item?')) {
            return;
        }
        
        const itemIndex = this.menu.findIndex(i => i.id === itemId);
        if (itemIndex === -1) return;
        
        try {
            // Delete from Firestore
            await this.deleteMenuItemFromFirestore(itemId);
            
            // Remove from local array
            this.menu.splice(itemIndex, 1);
            
            // Update local storage
            this.saveData('menu', this.menu);
            
            // Update UI
            this.renderMenu();
            this.renderMenuManagement();
            
            this.showNotification('Menu item deleted', 'success');
            
        } catch (error) {
            console.error('Error deleting menu item:', error);
            this.showNotification('Error deleting menu item: ' + error.message, 'error');
        }
    }
    
    // Show new category input
    showNewCategoryInput() {
        const newCategoryInput = document.getElementById('new-category-input');
        const newCategoryName = document.getElementById('new-category-name');
        
        if (newCategoryInput) newCategoryInput.style.display = 'block';
        if (newCategoryName) newCategoryName.focus();
    }
    
    // Hide new category input
    hideNewCategoryInput() {
        const newCategoryInput = document.getElementById('new-category-input');
        const newCategoryName = document.getElementById('new-category-name');
        
        if (newCategoryInput) newCategoryInput.style.display = 'none';
        if (newCategoryName) newCategoryName.value = '';
    }
    
    // Save new category
    async saveNewCategory() {
        const newCategoryName = document.getElementById('new-category-name');
        if (!newCategoryName) return;
        
        const categoryName = newCategoryName.value.trim().toUpperCase();
        
        if (!categoryName) {
            this.showNotification('Please enter a category name', 'error');
            return;
        }
        
        if (this.categories.includes(categoryName)) {
            this.showNotification('Category already exists', 'error');
            return;
        }
        
        try {
            // Add category to business in Firestore
            if (this.businessId) {
                await this.db.collection('businesses').doc(this.businessId).update({
                    categories: firebase.firestore.FieldValue.arrayUnion(categoryName)
                });
            }
            
            // Add category locally
            this.categories.push(categoryName);
            this.saveData('categories', this.categories);
            
            // Update UI
            this.hideNewCategoryInput();
            this.renderMenuManagement();
            
            // Set as selected in dropdown
            const itemCategory = document.getElementById('item-category');
            if (itemCategory) itemCategory.value = categoryName;
            
            this.showNotification(`Category "${categoryName}" added`, 'success');
            
        } catch (error) {
            console.error('Error saving category:', error);
            this.showNotification('Error saving category: ' + error.message, 'error');
        }
    }
    
    // Delete category
    async deleteCategory(category) {
        if (!confirm(`Delete category "${category}"? This will also delete all items in this category.`)) {
            return;
        }
        
        try {
            // Remove items in this category
            this.menu = this.menu.filter(item => item.category !== category);
            
            // Remove category from business in Firestore
            if (this.businessId) {
                await this.db.collection('businesses').doc(this.businessId).update({
                    categories: firebase.firestore.FieldValue.arrayRemove(category)
                });
                
                // Delete menu items from Firestore
                const menuSnapshot = await this.db.collection('businesses')
                    .doc(this.businessId)
                    .collection('menu')
                    .where('category', '==', category)
                    .get();
                
                const batch = this.db.batch();
                menuSnapshot.docs.forEach(doc => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
            }
            
            // Remove category locally
            this.categories = this.categories.filter(c => c !== category);
            
            // Save data
            this.saveData('menu', this.menu);
            this.saveData('categories', this.categories);
            
            // Update UI
            this.renderMenu();
            this.renderMenuManagement();
            
            this.showNotification(`Category "${category}" deleted`, 'success');
            
        } catch (error) {
            console.error('Error deleting category:', error);
            this.showNotification('Error deleting category: ' + error.message, 'error');
        }
    }
    
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
    
    // Hide profile setup modal
    hideProfileSetupModal() {
        const modal = bootstrap.Modal.getInstance(document.getElementById('profileSetupModal'));
        if (modal) {
            modal.hide();
        }
    }
    
    // Save initial profile
    async saveInitialProfile() {
        const initialBusinessName = document.getElementById('initial-business-name');
        const initialBusinessType = document.getElementById('initial-business-type');
        const initialBusinessPhone = document.getElementById('initial-business-phone');
        
        if (!initialBusinessName || !initialBusinessType || !initialBusinessPhone) return;
        
        const businessName = initialBusinessName.value;
        const businessType = initialBusinessType.value;
        const businessPhone = initialBusinessPhone.value;
        
        if (!businessName.trim()) {
            this.showNotification('Please enter a business name', 'error');
            return;
        }
        
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
    
    // Update profile tab with business info
    async updateProfileTab() {
        if (!this.businessId) return;
        
        try {
            const businessDoc = await this.db.collection('businesses').doc(this.businessId).get();
            if (businessDoc.exists) {
                const businessData = businessDoc.data();
                
                // Update form fields
                const businessName = document.getElementById('business-name');
                const businessType = document.getElementById('business-type');
                const businessDescription = document.getElementById('business-description');
                const businessPhone = document.getElementById('business-phone');
                const businessEmail = document.getElementById('business-email');
                const businessAddress = document.getElementById('business-address');
                
                if (businessName) businessName.value = businessData.name || '';
                if (businessType) businessType.value = businessData.type || 'restaurant';
                if (businessDescription) businessDescription.value = businessData.description || '';
                if (businessPhone) businessPhone.value = businessData.phone || '';
                if (businessEmail) businessEmail.value = businessData.email || '';
                if (businessAddress) businessAddress.value = businessData.address || '';
                
                // Update business info display
                const businessInfoDiv = document.getElementById('business-info');
                if (businessInfoDiv) {
                    businessInfoDiv.innerHTML = `
                        <p><strong>Name:</strong> ${businessData.name}</p>
                        <p><strong>Type:</strong> ${businessData.type}</p>
                        <p><strong>Phone:</strong> ${businessData.phone || 'Not set'}</p>
                        <p><strong>Email:</strong> ${businessData.email}</p>
                        <p><strong>Business ID:</strong> <small class="text-muted">${this.businessId}</small></p>
                    `;
                }
                
                // Load logo if exists
                if (businessData.logoUrl) {
                    const logoPreview = document.getElementById('logo-preview');
                    if (logoPreview) {
                        logoPreview.innerHTML = `
                            <img src="${businessData.logoUrl}" alt="Business Logo" style="max-width: 100px; max-height: 100px;" class="img-thumbnail">
                        `;
                    }
                }
                
                // Update business stats
                const totalBusinessOrders = document.getElementById('total-business-orders');
                const totalBusinessRevenue = document.getElementById('total-business-revenue');
                const totalBusinessProfit = document.getElementById('total-business-profit');
                
                if (totalBusinessOrders) totalBusinessOrders.textContent = this.completedOrders.length;
                if (totalBusinessRevenue) {
                    const totalRevenue = this.completedOrders.reduce((sum, order) => sum + order.total, 0);
                    totalBusinessRevenue.textContent = `₹${totalRevenue}`;
                }
                if (totalBusinessProfit) {
                    const totalProfit = this.completedOrders.reduce((sum, order) => sum + (order.totalProfit || 0), 0);
                    totalBusinessProfit.textContent = `₹${totalProfit}`;
                }
            }
        } catch (error) {
            console.error('Error updating profile tab:', error);
        }
    }
    
    // Handle business profile form submission
    async handleBusinessProfileSubmit() {
        const businessName = document.getElementById('business-name');
        const businessType = document.getElementById('business-type');
        const businessDescription = document.getElementById('business-description');
        const businessPhone = document.getElementById('business-phone');
        const businessEmail = document.getElementById('business-email');
        const businessAddress = document.getElementById('business-address');
        
        if (!businessName || !businessType || !businessDescription || 
            !businessPhone || !businessEmail || !businessAddress) return;
        
        const formData = {
            name: businessName.value,
            type: businessType.value,
            description: businessDescription.value,
            phone: businessPhone.value,
            email: businessEmail.value,
            address: businessAddress.value
        };
        
        // Handle logo upload if selected
        const logoFile = document.getElementById('business-logo').files[0];
        if (logoFile) {
            try {
                const logoUrl = await this.uploadLogo(logoFile);
                formData.logoUrl = logoUrl;
            } catch (error) {
                console.error('Error uploading logo:', error);
                this.showNotification('Error uploading logo', 'error');
            }
        }
        
        await this.saveBusinessProfile(formData);
    }
    
    // Upload logo to Firebase Storage
    async uploadLogo(file) {
        if (!this.businessId) return null;
        
        try {
            const storageRef = this.storage.ref();
            const logoRef = storageRef.child(`business-logos/${this.businessId}/${file.name}`);
            
            await logoRef.put(file);
            const downloadURL = await logoRef.getDownloadURL();
            
            return downloadURL;
        } catch (error) {
            console.error('Error uploading logo:', error);
            throw error;
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
    
    // Sync local data with Firestore when coming online
    async syncLocalDataWithFirestore() {
        if (!this.businessId || !navigator.onLine) return;
        
        try {
            // Sync menu items
            for (const item of this.menu) {
                await this.saveMenuItemToFirestore(item);
            }
            
            // Sync orders
            for (const order of this.orders) {
                if (!order.id || order.id.toString().length < 10) {
                    await this.saveOrderToFirestore(order);
                }
            }
            
            // Sync completed orders
            for (const order of this.completedOrders) {
                if (!order.id || order.id.toString().length < 10) {
                    await this.saveOrderToFirestore(order);
                }
            }
            
            console.log('Data synced with Firestore');
        } catch (error) {
            console.error('Error syncing data:', error);
        }
    }
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