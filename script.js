// Restaurant Order Management System with Firebase - COMPLETE WITH ALL FEATURES
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
    
    // Default menu items - EMPTY
    getDefaultMenu() {
        return []; // Start with empty menu
    }
    
    // Default categories - EMPTY (now with favorite property)
    getDefaultCategories() {
        return []; // Start with empty categories
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
        this.setupLongPressForQR();
        this.renderMenu();
        this.updateSummary();
        this.updateStats();
        this.updateBadges();
        this.updateNextOrderNumber();
        
        // Set default app name
        this.updateAppName();
        
        // Add global reference for HTML event handlers
        window.restaurantSystem = this;
    }
    
    // Setup tab navigation
    setupTabNavigation() {
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
                        const bsCollapse = new bootstrap.Collapse(navbar, {
                            toggle: false
                        });
                        bsCollapse.hide();
                    }
                }
            });
        });
        
        // Set the initial tab
        this.switchTab('take-order');
    }
    
    // Setup long press for QR code on profile tab
    setupLongPressForQR() {
        const profileNavItem = document.getElementById('profile-nav-item');
        let pressTimer;
        
        if (profileNavItem) {
            profileNavItem.addEventListener('touchstart', (e) => {
                pressTimer = setTimeout(() => {
                    this.showQRCodeModal();
                    e.preventDefault();
                }, 1000); // 1 second long press
            });
            
            profileNavItem.addEventListener('touchend', () => {
                clearTimeout(pressTimer);
            });
            
            profileNavItem.addEventListener('touchmove', () => {
                clearTimeout(pressTimer);
            });
            
            // For mouse devices
            profileNavItem.addEventListener('mousedown', (e) => {
                pressTimer = setTimeout(() => {
                    this.showQRCodeModal();
                    e.preventDefault();
                }, 1000);
            });
            
            profileNavItem.addEventListener('mouseup', () => {
                clearTimeout(pressTimer);
            });
            
            profileNavItem.addEventListener('mouseleave', () => {
                clearTimeout(pressTimer);
            });
        }
    }
    
    // Show QR code modal
    showQRCodeModal() {
        if (!this.businessData || !this.businessData.qrCodeUrl) {
            this.showNotification('No QR code uploaded yet', 'info');
            return;
        }
        
        const qrCodeImg = document.getElementById('modal-qr-code');
        const qrBusinessName = document.getElementById('qr-business-name');
        const qrBusinessPhone = document.getElementById('qr-business-phone');
        
        if (qrCodeImg) {
            qrCodeImg.src = this.businessData.qrCodeUrl;
        }
        
        if (qrBusinessName) {
            qrBusinessName.textContent = this.businessData.name || 'Stall Wise';
        }
        
        if (qrBusinessPhone) {
            qrBusinessPhone.textContent = this.businessData.phone ? `Phone: ${this.businessData.phone}` : '';
        }
        
        const modal = new bootstrap.Modal(document.getElementById('qrCodeModal'));
        modal.show();
    }
    
    // Switch between tabs
    switchTab(tabId) {
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
        
        // Update UI based on business name
        this.updateAppName();
        this.updateMenuTabName();
        
        // Load tab-specific data
        this.loadTabData(tabId);
    }
    
    // Update app name in navbar and title
    updateAppName() {
        const businessName = this.businessData?.name;
        const appName = businessName || 'Stall Wise';
        
        // Update navbar brand name
        const navbarBrand = document.getElementById('navbar-brand-name');
        if (navbarBrand) {
            navbarBrand.textContent = appName;
        }
        
        // Update page title
        document.title = appName;
        
        // Update menu management tab title
        const menuManagementTitle = document.getElementById('menu-management-title');
        if (menuManagementTitle) {
            const businessType = this.businessData?.type || 'restaurant';
            const isInventory = businessType === 'other' || businessType === 'event';
            const titleText = isInventory ? 'Inventory Management' : 'Menu Management';
            menuManagementTitle.innerHTML = `<i class="fas fa-edit me-2"></i>${titleText} - ${appName}`;
        }
    }
    
    // Update menu tab name based on business type
    updateMenuTabName() {
        const businessType = this.businessData?.type || 'restaurant';
        const isInventory = businessType === 'other' || businessType === 'event';
        const menuTabLink = document.querySelector('.nav-link[data-tab="menu-management"] .nav-text');
        
        if (isInventory) {
            if (menuTabLink) menuTabLink.textContent = 'Inventory';
        } else {
            if (menuTabLink) menuTabLink.textContent = 'Menu';
        }
    }
    
    // Load data for specific tab
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
    
    // ================= LOADING STATE MANAGEMENT =================
    
    // Show loading overlay
    showLoading(message = 'Processing...') {
        this.loadingQueue++;
        const overlay = document.getElementById('loading-overlay');
        const loadingText = overlay.querySelector('.loading-text');
        
        if (overlay && loadingText) {
            loadingText.textContent = message;
            overlay.classList.add('show');
        }
    }
    
    // Hide loading overlay
    hideLoading() {
        this.loadingQueue = Math.max(0, this.loadingQueue - 1);
        
        if (this.loadingQueue === 0) {
            const overlay = document.getElementById('loading-overlay');
            if (overlay) {
                overlay.classList.remove('show');
            }
        }
    }
    
    // Set button loading state
    setButtonLoading(button, isLoading) {
        if (isLoading) {
            button.classList.add('btn-loading');
            button.disabled = true;
        } else {
            button.classList.remove('btn-loading');
            button.disabled = false;
        }
    }
    
    // Wrap Firebase operations with loading state
    async withLoading(operation, loadingMessage = 'Processing...', button = null) {
        try {
            this.showLoading(loadingMessage);
            if (button) this.setButtonLoading(button, true);
            
            const result = await operation();
            return result;
        } catch (error) {
            console.error('Operation failed:', error);
            this.showNotification('Error: ' + error.message, 'error');
            throw error;
        } finally {
            this.hideLoading();
            if (button) this.setButtonLoading(button, false);
        }
    }
    
    // Show notification
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification alert alert-${type} alert-dismissible fade show`;
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        // Style the notification
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 9999;
            min-width: 300px;
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        
        // Add to document
        document.body.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }
    
    // ================= AUTHENTICATION =================
    
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
                this.businessData = null;
                this.showAuthModal();
            }
        });
    }
    
    // Load user data from Firestore
    async loadUserData(userId) {
        await this.withLoading(async () => {
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
        }, 'Loading user data...');
    }
    
    // Load business data from Firestore
    async loadBusinessData() {
        await this.withLoading(async () => {
            try {
                // Load business data
                const businessDoc = await this.db.collection('businesses').doc(this.businessId).get();
                if (businessDoc.exists) {
                    this.businessData = businessDoc.data();
                    
                    // Handle categories format (support both old and new)
                    let categoriesData = this.businessData.categories || [];
                    if (categoriesData.length > 0 && typeof categoriesData[0] === 'string') {
                        // Convert old string format to new object format
                        categoriesData = categoriesData.map(name => ({ 
                            name, 
                            favorite: false 
                        }));
                        
                        // Update in Firestore
                        await this.db.collection('businesses').doc(this.businessId).update({
                            categories: categoriesData
                        });
                    }
                    
                    this.categories = categoriesData;
                    this.nextOrderId = this.businessData.nextOrderId || 1001;
                    this.updateNextOrderNumber();
                    this.updateAppName();
                    this.updateMenuTabName();
                }
                
                // Load menu items
                await this.loadMenuFromFirestore();
                
                // Load orders
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
        }, 'Loading business data...');
    }
    
    // Load menu items from Firestore
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
                
                // Save to local storage as backup
                this.saveData('menu', this.menu);
            }
            // If empty, menu remains empty - user will add items manually
        } catch (error) {
            console.error('Error loading menu:', error);
            this.showNotification('Error loading menu', 'error');
        }
    }
    
    // Google Sign In
    async signInWithGoogle() {
        const button = document.getElementById('google-signin-btn');
        await this.withLoading(async () => {
            try {
                const result = await this.auth.signInWithPopup(this.googleProvider);
                this.currentUser = result.user;
                this.showNotification('Signed in successfully!', 'success');
            } catch (error) {
                console.error('Error signing in:', error);
                this.showNotification('Error signing in: ' + error.message, 'error');
            }
        }, 'Signing in...', button);
    }
    
    // Sign Out
    async signOut() {
        const button = document.getElementById('logout-btn');
        await this.withLoading(async () => {
            try {
                await this.auth.signOut();
                this.currentUser = null;
                this.userData = null;
                this.businessId = null;
                this.businessData = null;
                this.showNotification('Signed out successfully', 'info');
                this.showAuthModal();
            } catch (error) {
                console.error('Error signing out:', error);
                this.showNotification('Error signing out', 'error');
            }
        }, 'Signing out...', button);
    }
    
    // Create or update business profile
    async saveBusinessProfile(profileData) {
        await this.withLoading(async () => {
            try {
                if (!this.businessId) {
                    // Create new business
                    const businessRef = await this.db.collection('businesses').add({
                        ...profileData,
                        ownerId: this.currentUser.uid,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        categories: [], // Empty categories array
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
        }, 'Saving profile...');
    }
    
    // ================= EVENT LISTENERS =================
    
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
        
        // Action buttons - with loading states
        document.getElementById('clear-order-btn')?.addEventListener('click', () => this.clearCurrentOrder());
        
        const placeOrderBtn = document.getElementById('place-order-btn');
        placeOrderBtn?.addEventListener('click', () => this.placeOrder(placeOrderBtn));
        
        // Refresh orders with loading
        const refreshOrdersBtn = document.getElementById('refresh-orders-btn');
        refreshOrdersBtn?.addEventListener('click', () => this.loadBusinessData());
        
        // Print all
        document.getElementById('print-all-btn')?.addEventListener('click', () => this.printAllOrders());
        
        // Download PDF - UPDATED: Now uses date filter
        const downloadPdfBtn = document.getElementById('download-pdf-btn');
        downloadPdfBtn?.addEventListener('click', () => this.downloadPDFReport(downloadPdfBtn));
        
        // Clear completed with loading
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
        
        // Menu management - with loading states
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
        
        // QR Code modal button
        document.getElementById('show-qr-modal-btn')?.addEventListener('click', () => {
            this.showQRCodeModal();
        });
        
        // Download QR button
        document.getElementById('download-qr-btn')?.addEventListener('click', () => {
            this.downloadQRCode();
        });
        
        // File upload progress for logo and QR code
        document.getElementById('business-logo')?.addEventListener('change', (e) => {
            this.handleLogoUpload(e.target.files[0]);
        });
        
        document.getElementById('qr-code')?.addEventListener('change', (e) => {
            this.handleQRCodeUpload(e.target.files[0]);
        });
        
        // Auth and profile buttons
        document.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'google-signin-btn') {
                e.preventDefault();
                this.signInWithGoogle();
            }
            
            if (e.target && e.target.id === 'save-initial-profile-btn') {
                e.preventDefault();
                this.saveInitialProfile(e.target);
            }
            
            if (e.target && e.target.id === 'logout-btn') {
                e.preventDefault();
                this.signOut();
            }
        });
        
        // Business profile form
        const businessProfileForm = document.getElementById('business-profile-form');
        const saveProfileBtn = businessProfileForm?.querySelector('button[type="submit"]');
        businessProfileForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleBusinessProfileSubmit(saveProfileBtn);
        });
    }
    
    // ================= FILE UPLOAD METHODS =================
    
    // Handle logo upload to Firebase Storage
    async handleLogoUpload(file) {
        if (!file) return;
        
        if (!file.type.match('image.*')) {
            this.showNotification('Please select an image file for logo', 'error');
            return;
        }
        
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            this.showNotification('Logo file size should be less than 5MB', 'error');
            return;
        }
        
        await this.uploadFileToFirebase(file, 'logo', 'logo-progress', 'logo-progress-bar', 
            async (downloadURL) => {
                // Update business data with logo URL
                this.businessData.logoUrl = downloadURL;
                
                // Update in Firestore
                await this.db.collection('businesses').doc(this.businessId).update({
                    logoUrl: downloadURL,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                // Update preview
                this.updateLogoPreview(downloadURL);
                
                this.showNotification('Logo uploaded successfully!', 'success');
            },
            'logo'
        );
    }
    
    // Handle QR code upload to Firebase Storage
    async handleQRCodeUpload(file) {
        if (!file) return;
        
        if (!file.type.match('image.*')) {
            this.showNotification('Please select an image file for QR code', 'error');
            return;
        }
        
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            this.showNotification('QR code file size should be less than 5MB', 'error');
            return;
        }
        
        await this.uploadFileToFirebase(file, 'qr', 'qr-progress', 'qr-progress-bar', 
            async (downloadURL) => {
                // Update business data with QR code URL
                this.businessData.qrCodeUrl = downloadURL;
                
                // Update in Firestore
                await this.db.collection('businesses').doc(this.businessId).update({
                    qrCodeUrl: downloadURL,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                // Update preview
                this.updateQRPreview(downloadURL);
                
                this.showNotification('QR code uploaded successfully!', 'success');
            },
            'qr'
        );
    }
    
    // Generic file upload to Firebase Storage
    async uploadFileToFirebase(file, fileType, progressId, progressBarId, onSuccess, fileNamePrefix = 'file') {
        try {
            // Show progress bar
            const progressContainer = document.getElementById(progressId);
            const progressBar = document.getElementById(progressBarId);
            
            if (progressContainer && progressBar) {
                progressContainer.style.display = 'block';
                progressBar.style.width = '0%';
                progressBar.textContent = '0%';
            }
            
            // Create a reference to the file location
            const storageRef = this.storage.ref();
            const fileRef = storageRef.child(`businesses/${this.businessId}/${fileNamePrefix}_${Date.now()}_${file.name}`);
            
            // Upload file
            const uploadTask = fileRef.put(file);
            
            // Listen for state changes, errors, and completion
            uploadTask.on('state_changed',
                (snapshot) => {
                    // Progress monitoring
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    if (progressBar) {
                        progressBar.style.width = progress + '%';
                        progressBar.textContent = Math.round(progress) + '%';
                    }
                },
                (error) => {
                    console.error(`Error uploading ${fileType}:`, error);
                    this.showNotification(`Error uploading ${fileType}: ${error.message}`, 'error');
                    
                    // Hide progress bar on error
                    if (progressContainer) {
                        progressContainer.style.display = 'none';
                    }
                },
                async () => {
                    // Upload completed successfully
                    const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                    
                    // Hide progress bar
                    if (progressContainer) {
                        progressContainer.style.display = 'none';
                    }
                    
                    // Call success callback
                    await onSuccess(downloadURL);
                }
            );
            
        } catch (error) {
            console.error(`Error starting ${fileType} upload:`, error);
            this.showNotification(`Error uploading ${fileType}`, 'error');
        }
    }
    
    // Update logo preview
    updateLogoPreview(url) {
        const previewContainer = document.getElementById('logo-preview');
        if (previewContainer) {
            previewContainer.innerHTML = `
                <div class="logo-preview-container">
                    <img src="${url}" alt="Business Logo" class="img-thumbnail logo-preview">
                    <div class="mt-1 small text-muted">Logo Preview</div>
                </div>
            `;
        }
    }
    
    // Update QR code preview
    updateQRPreview(url) {
        const previewContainer = document.getElementById('qr-preview');
        const displayContainer = document.getElementById('qr-display-container');
        const qrDisplay = document.getElementById('qr-display');
        
        if (previewContainer) {
            previewContainer.innerHTML = `
                <div class="qr-preview-container">
                    <img src="${url}" alt="QR Code" class="img-thumbnail qr-preview">
                    <div class="mt-1 small text-muted">QR Code Preview</div>
                </div>
            `;
        }
        
        if (displayContainer && qrDisplay) {
            displayContainer.style.display = 'block';
            qrDisplay.src = url;
        }
    }
    
    // Download QR code
    downloadQRCode() {
        if (!this.businessData?.qrCodeUrl) {
            this.showNotification('No QR code available to download', 'error');
            return;
        }
        
        const link = document.createElement('a');
        link.href = this.businessData.qrCodeUrl;
        link.download = `qr-code-${this.businessData.name || 'business'}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showNotification('QR code downloaded successfully!', 'success');
    }
    
    // ================= MENU MANAGEMENT =================
    
    // Update quick actions based on favorite categories
    updateQuickActions() {
        const quickActionsContainer = document.querySelector('#quick-actions-container');
        if (!quickActionsContainer) return;
        
        // Clear all existing content
        quickActionsContainer.innerHTML = '';
        
        // Get favorite categories
        const favoriteCategories = this.categories.filter(cat => cat.favorite);
        
        if (favoriteCategories.length === 0) {
            quickActionsContainer.innerHTML = `
                <div class="col-12 text-center py-3">
                    <p class="text-muted small">Mark categories as favorites in Menu Management</p>
                </div>
            `;
            return;
        }
        
        // Add favorite categories as quick actions
        favoriteCategories.forEach((category, index) => {
            // Limit to 6 quick actions
            if (index >= 6) return;
            
            const col = document.createElement('div');
            col.className = 'col-6';
            
            // Get appropriate icon based on category name
            const icon = this.getCategoryIcon(category.name);
            
            col.innerHTML = `
                <button class="btn btn-outline-info w-100 quick-category-btn" 
                        data-category="${category.name}">
                    <i class="fas fa-${icon} me-1"></i> ${category.name}
                </button>
            `;
            
            quickActionsContainer.appendChild(col);
            
            // Add event listener
            col.querySelector('.quick-category-btn').addEventListener('click', (e) => {
                const categoryName = e.currentTarget.getAttribute('data-category');
                this.showCategory(categoryName);
            });
        });
    }
    
    // Get appropriate icon for category
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
        return 'tag'; // default icon
    }
    
    // Render menu items (filter out out-of-stock items)
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
        
        // Group available items by category
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
                <h6>${categoryName}</h6>
                <div class="row" id="items-${categoryName.replace(/\s+/g, '-')}"></div>
            `;
            
            const itemsContainer = categoryDiv.querySelector(`#items-${categoryName.replace(/\s+/g, '-')}`);
            
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
                            <div class="menu-item-price">₹${item.price}${item.tax > 0 ? ` (+${item.tax}% tax)` : ''}</div>
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
    
    // Adjust item quantity with tax calculation
    adjustQuantity(itemId, change) {
        const input = document.getElementById(`qty-${itemId}`);
        if (!input) return;
        
        let currentValue = parseInt(input.value) || 0;
        let newValue = currentValue + change;
        
        if (newValue < 0) newValue = 0;
        
        input.value = newValue;
        this.setQuantity(itemId, newValue);
    }
    
    // Set item quantity with tax calculation
    setQuantity(itemId, quantity) {
        // Find the item in current order
        const existingItemIndex = this.currentOrder.items.findIndex(item => item.id === itemId);
        const menuItem = this.menu.find(item => item.id === itemId);
        
        if (!menuItem) return;
        
        if (quantity > 0) {
            // Calculate tax amount
            const price = menuItem.price;
            const taxRate = menuItem.tax || 0;
            const taxAmount = (price * quantity * taxRate) / 100;
            const subtotal = price * quantity;
            const total = subtotal + taxAmount;
            
            if (existingItemIndex >= 0) {
                // Update existing item
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
                // Add new item
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
    
    // Update selected items table with tax information - FIXED
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
    
    // Update order summary with tax
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
            'upi': 'UPI',
            'qr': 'QR Code'
        };
        const summaryPayment = document.getElementById('summary-payment');
        if (summaryPayment) {
            summaryPayment.textContent = paymentMap[this.currentOrder.paymentMethod] || 'Cash';
        }
        
        // Update items in summary
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
        
        // Update totals in summary
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
        if (todayRevenueEl) todayRevenueEl.textContent = `₹${todayRevenue.toFixed(2)}`;
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
    
    // Place new order with loading and tax calculation
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
            // Calculate totals with tax
            const subtotal = this.currentOrder.items.reduce((sum, item) => sum + item.subtotal, 0);
            const totalTax = this.currentOrder.items.reduce((sum, item) => sum + item.taxAmount, 0);
            const total = subtotal + totalTax;
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
                businessId: this.businessId,
                businessName: this.businessData?.name || 'Stall Wise'
            };
            
            try {
                // Save to Firestore
                const orderRef = await this.db.collection('businesses')
                    .doc(this.businessId)
                    .collection('orders')
                    .add({
                        ...order,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                
                // Update next order ID in business document
                await this.db.collection('businesses').doc(this.businessId).update({
                    nextOrderId: this.nextOrderId + 1,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                // Add to local orders array
                order.id = orderRef.id;
                this.orders.unshift(order);
                
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
        }, 'Placing order...', button);
    }
    
    // Clear current order - FIXED
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
        
        this.showNotification('Order cleared successfully', 'success');
    }
    
    // Show category
    showCategory(category) {
        const element = document.getElementById(`category-${category.replace(/\s+/g, '-')}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
    
    // ================= ONGOING ORDERS =================
    
    // Render ongoing orders - FIXED VIEW BUTTON
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
        });
        
        tbody.innerHTML = html;
        
        // Add event listeners with loading
        document.querySelectorAll('.view-order-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const orderId = e.currentTarget.getAttribute('data-order-id');
                this.viewOrderDetails(orderId);
            });
        });
        
        document.querySelectorAll('.complete-order-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const orderId = e.currentTarget.getAttribute('data-order-id');
                this.completeOrder(orderId, btn);
            });
        });
        
        document.querySelectorAll('.delete-order-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const orderId = e.currentTarget.getAttribute('data-order-id');
                this.deleteOrder(orderId, btn);
            });
        });
    }
    
    // View order details - FIXED
    viewOrderDetails(orderId) {
        const order = this.orders.find(o => o.id == orderId) || 
                     this.completedOrders.find(o => o.id == orderId);
        
        if (!order) {
            this.showNotification('Order not found', 'error');
            return;
        }
        
        // Populate modal
        document.getElementById('modal-order-no').textContent = order.orderNumber || order.id;
        document.getElementById('modal-customer').textContent = order.customerName || 'Walk-in';
        document.getElementById('modal-phone').textContent = order.customerPhone || 'N/A';
        document.getElementById('modal-order-time').textContent = new Date(order.orderTime).toLocaleString();
        document.getElementById('modal-order-type').textContent = order.orderType;
        
        // Populate items
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
        
        // Update totals in modal
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
    
    // Complete order with loading
    async completeOrder(orderId, button) {
        const orderIndex = this.orders.findIndex(o => o.id == orderId);
        if (orderIndex === -1) return;
        
        await this.withLoading(async () => {
            try {
                // Remove from ongoing orders array
                const [completedOrder] = this.orders.splice(orderIndex, 1);
                
                // Update order in Firestore
                await this.db.collection('businesses')
                    .doc(this.businessId)
                    .collection('orders')
                    .doc(orderId)
                    .update({
                        status: 'completed',
                        completedTime: new Date().toISOString(),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
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
        }, 'Completing order...', button);
    }
    
    // Delete order with loading
    async deleteOrder(orderId, button) {
        if (!confirm('Are you sure you want to delete this order?')) {
            return;
        }
        
        const orderIndex = this.orders.findIndex(o => o.id == orderId);
        if (orderIndex === -1) return;
        
        await this.withLoading(async () => {
            try {
                // Delete from Firestore
                await this.db.collection('businesses')
                    .doc(this.businessId)
                    .collection('orders')
                    .doc(orderId)
                    .delete();
                
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
        }, 'Deleting order...', button);
    }
    
    // Print all orders
    printAllOrders() {
        window.print();
    }
    
    // ================= COMPLETED ORDERS =================
    
    // Setup date filters
    setupDateFilters() {
        const today = new Date().toISOString().split('T')[0];
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
        const twoYearsAgoStr = twoYearsAgo.toISOString().split('T')[0];
        
        // Set default values for completed orders filter
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
        
        // Set default values for analytics filter
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
    
    // Get filtered orders based on date range from completed orders page
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
    
    // Render completed orders with date range filter
    renderCompletedOrders() {
        const tbody = document.getElementById('completed-orders-body');
        const emptyState = document.getElementById('no-completed-orders');
        
        if (!tbody || !emptyState) return;
        
        // Get filtered orders
        const filteredOrders = this.getFilteredOrders();
        
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
                    <td>₹${order.total ? order.total.toFixed(2) : order.total}</td>
                    <td class="${profitClass}">₹${profit.toFixed(2)}</td>
                    <td>${completedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
        
        // Update sales summary with filtered orders
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
        
        if (totalRevenueEl) totalRevenueEl.textContent = `₹${totalRevenue.toFixed(2)}`;
        if (totalOrdersEl) totalOrdersEl.textContent = totalOrders;
        if (totalProfitEl) totalProfitEl.textContent = `₹${totalProfit.toFixed(2)}`;
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
                const itemProfit = item.total - (itemCost * item.quantity);
                
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
    
    // Download PDF report with loading - UPDATED: Uses date filter
    async downloadPDFReport(button) {
        // Get filtered orders based on date range
        const filteredOrders = this.getFilteredOrders();
        
        if (filteredOrders.length === 0) {
            this.showNotification('No orders in selected date range to generate report', 'error');
            return;
        }
        
        await this.withLoading(async () => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Get date range info
            const dateFrom = document.getElementById('date-from')?.value;
            const dateTo = document.getElementById('date-to')?.value;
            const dateRangeText = dateFrom && dateTo ? 
                `${new Date(dateFrom).toLocaleDateString()} to ${new Date(dateTo).toLocaleDateString()}` : 
                'All Time';
            
            // Business info
            const businessName = this.businessData?.name || 'Stall Wise';
            
            // Add title
            doc.setFontSize(20);
            doc.setTextColor(40, 40, 40);
            doc.text(`${businessName} - Sales Report`, 105, 20, { align: 'center' });
            
            // Add date range
            doc.setFontSize(12);
            doc.setTextColor(100, 100, 100);
            doc.text(`Date Range: ${dateRangeText}`, 105, 30, { align: 'center' });
            
            // Add generation date
            doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 105, 38, { align: 'center' });
            
            // Add summary
            const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.total, 0);
            const totalCost = filteredOrders.reduce((sum, order) => sum + (order.totalCost || 0), 0);
            const totalProfit = totalRevenue - totalCost;
            const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) : 0;
            const totalOrders = filteredOrders.length;
            
            doc.setFontSize(14);
            doc.setTextColor(0, 0, 0);
            doc.text('Summary', 20, 50);
            
            doc.setFontSize(11);
            doc.text(`Business: ${businessName}`, 20, 60);
            doc.text(`Total Orders: ${totalOrders}`, 20, 67);
            doc.text(`Total Revenue: ₹${totalRevenue.toFixed(2)}`, 20, 74);
            doc.text(`Total Cost: ₹${totalCost.toFixed(2)}`, 20, 81);
            doc.text(`Total Profit: ₹${totalProfit.toFixed(2)}`, 20, 88);
            doc.text(`Profit Margin: ${profitMargin}%`, 20, 95);
            
            // Calculate item-wise sales
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
            
            // Prepare table data for item-wise sales with profit
            const tableData = Object.entries(itemSales).map(([itemName, data], index) => {
                const margin = data.revenue > 0 ? ((data.profit / data.revenue) * 100).toFixed(1) : 0;
                return [
                    index + 1,
                    itemName,
                    data.quantity,
                    `₹${data.revenue.toFixed(2)}`,
                    `₹${data.cost.toFixed(2)}`,
                    `₹${data.profit.toFixed(2)}`,
                    `${margin}%`
                ];
            });
            
            // Add item-wise sales table with profit
            doc.autoTable({
                head: [['#', 'Item Name', 'Qty', 'Revenue', 'Cost', 'Profit', 'Margin']],
                body: tableData,
                startY: 105,
                theme: 'grid',
                headStyles: { fillColor: [255, 107, 53] }
            });
            
            // Save PDF with date range in filename
            const fileName = dateFrom && dateTo ? 
                `${businessName}_report_${dateFrom}_to_${dateTo}.pdf` :
                `${businessName}_report_all_time.pdf`;
            
            doc.save(fileName);
            
            this.showNotification('PDF report with profit analysis downloaded!', 'success');
        }, 'Generating PDF...', button);
    }
    
    // Clear completed orders with loading
    async clearCompletedOrders(button) {
        if (this.completedOrders.length === 0) {
            this.showNotification('No completed orders to clear', 'error');
            return;
        }
        
        if (confirm('Are you sure you want to clear all completed orders? This action cannot be undone.')) {
            await this.withLoading(async () => {
                try {
                    // Delete from Firestore
                    for (const order of this.completedOrders) {
                        await this.db.collection('businesses')
                            .doc(this.businessId)
                            .collection('orders')
                            .doc(order.id)
                            .delete();
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
            }, 'Clearing orders...', button);
        }
    }
    
    // ================= MENU MANAGEMENT METHODS =================
    
    // Render menu management table
    renderMenuManagement() {
        const tbody = document.getElementById('menu-management-body');
        if (!tbody) return;
        
        if (this.menu.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-4">
                        <i class="fas fa-utensils fa-2x text-muted mb-2"></i>
                        <p class="text-muted">No menu items added yet</p>
                        <p class="text-muted small">Start by adding a category and then menu items</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        let html = '';
        
        // Group items by category
        const itemsByCategory = {};
        this.menu.forEach(item => {
            if (!itemsByCategory[item.category]) {
                itemsByCategory[item.category] = [];
            }
            itemsByCategory[item.category].push(item);
        });
        
        // If no categories yet, show message
        if (this.categories.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-4">
                        <i class="fas fa-tags fa-2x text-muted mb-2"></i>
                        <p class="text-muted">No categories added yet</p>
                        <button class="btn btn-sm btn-primary mt-2" id="add-first-category-btn">
                            <i class="fas fa-plus me-1"></i> Add First Category
                        </button>
                    </td>
                </tr>
            `;
            
            // Add event listener for the button
            setTimeout(() => {
                document.getElementById('add-first-category-btn')?.addEventListener('click', () => {
                    this.showNewCategoryInput();
                });
            }, 100);
            
            return;
        }
        
        // Render items grouped by category
        this.categories.forEach(categoryObj => {
            const categoryName = categoryObj.name || categoryObj;
            const items = itemsByCategory[categoryName] || [];
            
            // Add category header row with favorite star
            const isFavorite = categoryObj.favorite || false;
            html += `
                <tr class="category-header" style="background-color: #f8f9fa;">
                    <td colspan="8">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <strong>${categoryName}</strong>
                                <button class="btn btn-sm btn-link favorite-category-btn ms-2" 
                                        data-category="${categoryName}" 
                                        title="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
                                    <i class="fas fa-star ${isFavorite ? 'text-warning' : 'text-muted'}"></i>
                                </button>
                            </div>
                            <button class="btn btn-sm btn-outline-danger delete-category-btn" 
                                    data-category="${categoryName}" 
                                    title="Delete Category and all its items">
                                <i class="fas fa-trash"></i> Delete Category
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            
            // Add items for this category
            items.forEach(item => {
                const profit = (item.price - item.cost);
                const profitMargin = item.price > 0 ? ((profit / item.price) * 100).toFixed(1) : 0;
                const profitClass = profit >= 0 ? 'profit-positive' : 'profit-negative';
                
                html += `
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
                                       ${item.outOfStock ? 'checked' : ''}
                                       title="Mark as out of stock">
                                <label class="form-check-label small">Out of Stock</label>
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
            });
        });
        
        tbody.innerHTML = html;
        
        // Add event listeners for edit and delete buttons
        document.querySelectorAll('.edit-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const itemId = e.currentTarget.getAttribute('data-item-id');
                this.editMenuItem(itemId);
            });
        });
        
        document.querySelectorAll('.delete-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const itemId = e.currentTarget.getAttribute('data-item-id');
                this.deleteMenuItem(itemId, btn);
            });
        });
        
        document.querySelectorAll('.delete-category-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const category = e.currentTarget.getAttribute('data-category');
                this.deleteCategoryWithItems(category, btn);
            });
        });
        
        // Add event listeners for favorite category buttons
        document.querySelectorAll('.favorite-category-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const category = e.currentTarget.getAttribute('data-category');
                this.toggleCategoryFavorite(category, btn);
            });
        });
        
        // Add event listeners for out of stock checkboxes
        document.querySelectorAll('.out-of-stock-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const itemId = e.target.getAttribute('data-item-id');
                const isOutOfStock = e.target.checked;
                this.updateItemStockStatus(itemId, isOutOfStock, checkbox);
            });
        });
        
        // Make rows clickable
        document.querySelectorAll('.menu-item-row').forEach(row => {
            row.addEventListener('click', (e) => {
                if (!e.target.closest('.btn') && !e.target.closest('.form-check')) {
                    const itemId = row.getAttribute('data-item-id');
                    this.editMenuItem(itemId);
                }
            });
        });
    }
    
    // Toggle category favorite status
    async toggleCategoryFavorite(categoryName, button) {
        await this.withLoading(async () => {
            try {
                // Find the category
                const categoryIndex = this.categories.findIndex(cat => 
                    (cat.name || cat) === categoryName
                );
                
                if (categoryIndex === -1) return;
                
                // Toggle favorite status
                const category = this.categories[categoryIndex];
                if (typeof category === 'object') {
                    category.favorite = !category.favorite;
                } else {
                    // Convert string category to object
                    this.categories[categoryIndex] = {
                        name: category,
                        favorite: true
                    };
                }
                
                // Update in Firestore
                await this.db.collection('businesses').doc(this.businessId).update({
                    categories: this.categories,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                // Update UI
                this.renderMenuManagement();
                this.updateQuickActions();
                
                // Update favorite button
                const isFavorite = typeof category === 'object' ? category.favorite : true;
                const icon = button.querySelector('i');
                if (icon) {
                    icon.className = `fas fa-star ${isFavorite ? 'text-warning' : 'text-muted'}`;
                    button.title = isFavorite ? 'Remove from favorites' : 'Add to favorites';
                }
                
                this.showNotification(
                    `${categoryName} ${isFavorite ? 'added to' : 'removed from'} favorites`, 
                    'success'
                );
                
            } catch (error) {
                console.error('Error toggling category favorite:', error);
                this.showNotification('Error updating category', 'error');
            }
        }, 'Updating category...', button);
    }
    
    // Update item stock status
    async updateItemStockStatus(itemId, isOutOfStock, checkbox) {
        await this.withLoading(async () => {
            try {
                // Update in Firestore
                await this.db.collection('businesses')
                    .doc(this.businessId)
                    .collection('menu')
                    .doc(itemId)
                    .update({
                        outOfStock: isOutOfStock,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                
                // Update local array
                const itemIndex = this.menu.findIndex(item => item.id === itemId);
                if (itemIndex !== -1) {
                    this.menu[itemIndex].outOfStock = isOutOfStock;
                }
                
                // Save to local storage
                this.saveData('menu', this.menu);
                
                // Update UI in menu management
                const row = checkbox.closest('.menu-item-row');
                if (row) {
                    if (isOutOfStock) {
                        row.classList.add('out-of-stock');
                        // Add out of stock badge if not exists
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
                        // Remove out of stock badge
                        const badge = row.querySelector('.badge.bg-danger');
                        if (badge) badge.remove();
                    }
                }
                
                // Update menu items in order tab immediately
                this.renderMenu();
                
                this.showNotification(
                    `Item marked as ${isOutOfStock ? 'out of stock' : 'available'}`, 
                    'success'
                );
                
            } catch (error) {
                console.error('Error updating item stock status:', error);
                this.showNotification('Error updating item status', 'error');
                
                // Revert checkbox state
                checkbox.checked = !isOutOfStock;
            }
        }, 'Updating item status...');
    }
    
    // Delete category with all its items
    async deleteCategoryWithItems(categoryName, button) {
        // Get items in this category
        const itemsInCategory = this.menu.filter(item => item.category === categoryName);
        
        if (itemsInCategory.length > 0) {
            const confirmed = confirm(
                `Warning: This will delete the category "${categoryName}" and all ${itemsInCategory.length} item(s) in it.\n\nThis action cannot be undone. Are you sure you want to proceed?`
            );
            
            if (!confirmed) return;
        } else {
            if (!confirm(`Are you sure you want to delete the category "${categoryName}"?`)) {
                return;
            }
        }
        
        await this.withLoading(async () => {
            try {
                // Delete all items in this category from Firestore
                for (const item of itemsInCategory) {
                    await this.db.collection('businesses')
                        .doc(this.businessId)
                        .collection('menu')
                        .doc(item.id)
                        .delete();
                    
                    // Remove from local array
                    this.menu = this.menu.filter(menuItem => menuItem.id !== item.id);
                }
                
                // Remove category from categories array
                this.categories = this.categories.filter(cat => 
                    (cat.name || cat) !== categoryName
                );
                
                // Update in Firestore
                await this.db.collection('businesses').doc(this.businessId).update({
                    categories: this.categories,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                // Update UI
                this.loadCategoriesDropdown();
                this.renderMenuManagement();
                this.renderMenu();
                this.updateQuickActions();
                
                // Save to local storage
                this.saveData('menu', this.menu);
                this.saveData('categories', this.categories);
                
                this.showNotification(
                    `Category "${categoryName}" and ${itemsInCategory.length} item(s) deleted successfully`, 
                    'success'
                );
                
            } catch (error) {
                console.error('Error deleting category with items:', error);
                this.showNotification('Error deleting category and items', 'error');
            }
        }, 'Deleting category...', button);
    }
    
    // Load categories into dropdown
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
    
    // Show new category input
    showNewCategoryInput() {
        document.getElementById('new-category-input').style.display = 'block';
        document.getElementById('new-category-name').focus();
    }
    
    // Hide new category input
    hideNewCategoryInput() {
        document.getElementById('new-category-input').style.display = 'none';
        document.getElementById('new-category-name').value = '';
    }
    
    // Save new category with loading
    async saveNewCategory(button) {
        const categoryInput = document.getElementById('new-category-name');
        const categoryName = categoryInput.value.trim().toUpperCase();
        
        if (!categoryName) {
            this.showNotification('Please enter a category name', 'error');
            return;
        }
        
        // Check if category already exists
        const exists = this.categories.some(cat => 
            (cat.name || cat) === categoryName
        );
        
        if (exists) {
            this.showNotification('Category already exists', 'error');
            return;
        }
        
        await this.withLoading(async () => {
            try {
                // Add to local array as object
                this.categories.push({
                    name: categoryName,
                    favorite: false
                });
                
                // Update in Firestore
                await this.db.collection('businesses').doc(this.businessId).update({
                    categories: this.categories,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                // Update UI
                this.loadCategoriesDropdown();
                this.hideNewCategoryInput();
                
                // Clear the input
                categoryInput.value = '';
                
                this.showNotification(`Category "${categoryName}" added successfully`, 'success');
                
                // If this is the first category, refresh menu management
                if (this.categories.length === 1) {
                    this.renderMenuManagement();
                }
                
            } catch (error) {
                console.error('Error saving category:', error);
                this.showNotification('Error saving category', 'error');
            }
        }, 'Saving category...', button);
    }
    
    // Edit menu item
    editMenuItem(itemId) {
        const item = this.menu.find(item => item.id === itemId);
        if (!item) return;
        
        // Populate form
        document.getElementById('item-category').value = item.category;
        document.getElementById('item-name').value = item.name;
        document.getElementById('item-price').value = item.price;
        document.getElementById('item-cost').value = item.cost;
        document.getElementById('item-tax').value = item.tax || 0;
        document.getElementById('item-out-of-stock').checked = item.outOfStock || false;
        document.getElementById('edit-item-id').value = itemId;
        
        // Change button text
        const submitBtn = document.querySelector('#menu-item-form button[type="submit"]');
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-save me-1"></i> Update Item';
            submitBtn.classList.remove('btn-success');
            submitBtn.classList.add('btn-primary');
        }
        
        // Scroll to form
        document.getElementById('menu-item-form').scrollIntoView({ behavior: 'smooth' });
    }
    
    // Cancel edit menu item
    cancelEditMenuItem() {
        this.resetMenuItemForm();
    }
    
    // Reset menu item form
    resetMenuItemForm() {
        document.getElementById('menu-item-form').reset();
        document.getElementById('item-tax').value = 0;
        document.getElementById('item-out-of-stock').checked = false;
        document.getElementById('edit-item-id').value = '';
        
        // Reset button
        const submitBtn = document.querySelector('#menu-item-form button[type="submit"]');
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-save me-1"></i> Save Item';
            submitBtn.classList.remove('btn-primary');
            submitBtn.classList.add('btn-success');
        }
    }
    
    // Save menu item with loading
    async saveMenuItem(button) {
        const category = document.getElementById('item-category').value;
        const name = document.getElementById('item-name').value.trim();
        const price = parseFloat(document.getElementById('item-price').value);
        const cost = parseFloat(document.getElementById('item-cost').value);
        const tax = parseFloat(document.getElementById('item-tax').value) || 0;
        const outOfStock = document.getElementById('item-out-of-stock').checked;
        const itemId = document.getElementById('edit-item-id').value;
        
        // Validation
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
                    // Update existing item
                    await this.db.collection('businesses')
                        .doc(this.businessId)
                        .collection('menu')
                        .doc(itemId)
                        .update(itemData);
                    
                    // Update local array
                    const index = this.menu.findIndex(item => item.id === itemId);
                    if (index !== -1) {
                        this.menu[index] = { ...this.menu[index], ...itemData };
                    }
                    
                    this.showNotification('Menu item updated successfully', 'success');
                } else {
                    // Add new item
                    itemData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    
                    const newItemRef = await this.db.collection('businesses')
                        .doc(this.businessId)
                        .collection('menu')
                        .add(itemData);
                    
                    // Add to local array
                    this.menu.push({
                        id: newItemRef.id,
                        ...itemData
                    });
                    
                    this.showNotification('Menu item added successfully', 'success');
                }
                
                // Reset form
                this.resetMenuItemForm();
                
                // Update UI
                this.renderMenuManagement();
                this.renderMenu();
                
                // Save to local storage
                this.saveData('menu', this.menu);
                
            } catch (error) {
                console.error('Error saving menu item:', error);
                this.showNotification('Error saving menu item', 'error');
            }
        }, 'Saving menu item...', button);
    }
    
    // Delete menu item with loading
    async deleteMenuItem(itemId, button) {
        if (!confirm('Are you sure you want to delete this menu item?')) {
            return;
        }
        
        await this.withLoading(async () => {
            try {
                // Delete from Firestore
                await this.db.collection('businesses')
                    .doc(this.businessId)
                    .collection('menu')
                    .doc(itemId)
                    .delete();
                
                // Remove from local array
                this.menu = this.menu.filter(item => item.id !== itemId);
                
                // Update UI
                this.renderMenuManagement();
                this.renderMenu();
                
                // Save to local storage
                this.saveData('menu', this.menu);
                
                // Reset form if editing this item
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
    
    // ================= AUTH MODALS =================
    
    // Show authentication modal
    showAuthModal() {
        const modal = new bootstrap.Modal(document.getElementById('authModal'));
        modal.show();
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
        const modal = new bootstrap.Modal(document.getElementById('profileSetupModal'));
        modal.show();
    }
    
    // Hide profile setup modal
    hideProfile
