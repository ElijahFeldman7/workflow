document.addEventListener('DOMContentLoaded', async function() {
    const page = document.body.dataset.page;

    const { collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc, getDoc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    const db = window.firebaseDb;
    const auth = window.firebaseAuth;
    const { onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");

    // Settings Cog functionality
    const settingsCog = document.querySelector('.settings-cog');
    const settingsPanel = document.querySelector('.settings-panel');
    if(settingsCog && settingsPanel) {
        settingsCog.addEventListener('click', () => {
            settingsPanel.classList.toggle('active');
        });
    }

    switch (page) {
        case 'tasks':
            const taskForm = document.getElementById('task-input-form');
            const taskInput = document.getElementById('new-task-input');
            const taskList = document.getElementById('task-list');

            async function renderTasks() {
                if(!taskList) return;
                taskList.innerHTML = '';
                const user = auth.currentUser;
                if (user) {
                    const q = query(collection(db, "tasks"), where("userId", "==", user.uid));
                    const querySnapshot = await getDocs(q);
                    const tasks = [];
                    querySnapshot.forEach((doc) => tasks.push({ id: doc.id, ...doc.data() }));
                    tasks.sort((a, b) => (a.createdAt?.toDate() || 0) - (b.createdAt?.toDate() || 0));
                    
                    tasks.forEach((task) => {
                        const li = document.createElement('li');
                        li.className = `flex items-center p-3 rounded-lg transition-colors hover:bg-gray-50 ${task.completed ? 'bg-green-50' : 'bg-white'}`;
                        li.innerHTML = `
                            <input type="checkbox" data-id="${task.id}" class="h-5 w-5 rounded border-gray-300 text-blue-500 focus:ring-blue-400" ${task.completed ? 'checked' : ''}>
                            <span class="ml-4 flex-grow cursor-pointer ${task.completed ? 'line-through text-gray-500' : ''}" data-id="${task.id}">${task.text}</span>
                            <button class="delete-btn text-gray-400 hover:text-red-500 font-bold text-xl ml-auto" data-id="${task.id}">&times;</button>
                        `;
                        taskList.appendChild(li);
                    });
                } else {
                    taskList.innerHTML = '<p class="text-center text-gray-500">Please sign in to manage your tasks.</p>';
                }
            }

            taskForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const user = auth.currentUser;
                if (!user) { alert('Please sign in to add tasks.'); return; }
                if (taskInput.value.trim() === '') return;
                await addDoc(collection(db, "tasks"), { text: taskInput.value.trim(), completed: false, userId: user.uid, createdAt: new Date() });
                taskInput.value = '';
                renderTasks();
            });

            taskList.addEventListener('click', async (e) => {
                const user = auth.currentUser;
                if (!user) return;
                const id = e.target.dataset.id;

                if (e.target.matches('input[type="checkbox"]')) {
                    await updateDoc(doc(db, "tasks", id), { completed: e.target.checked });
                    renderTasks();
                }
                if (e.target.matches('.delete-btn')) {
                    await deleteDoc(doc(db, "tasks", id));
                    renderTasks();
                }
                if (e.target.matches('span')) {
                    const currentText = e.target.textContent;
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.value = currentText;
                    input.className = 'flex-grow p-1 border border-gray-300 rounded';
                    e.target.replaceWith(input);
                    input.focus();
                    input.addEventListener('blur', async () => {
                        await updateDoc(doc(db, "tasks", id), { text: input.value });
                        renderTasks();
                    });
                    input.addEventListener('keydown', async (ev) => {
                        if (ev.key === 'Enter') {
                            await updateDoc(doc(db, "tasks", id), { text: input.value });
                            renderTasks();
                        }
                    });
                }
            });
            onAuthStateChanged(auth, renderTasks);
            renderTasks();
            break;
        case 'notes':
            const notesArea = document.getElementById('notes-area');
            const notesSaveStatus = document.getElementById('notes-save-status');
            let notesTimeout;

            async function loadNotes() {
                const user = auth.currentUser;
                if (user) {
                    const noteRef = doc(db, "notes", user.uid);
                    const noteSnap = await getDoc(noteRef);
                    if (noteSnap.exists()) {
                        notesArea.value = noteSnap.data().content;
                    } else {
                        notesArea.value = '';
                    }
                } else {
                    notesArea.value = 'Please sign in to use the knowledge base.';
                    notesArea.disabled = true;
                }
            }

            async function saveNotes() {
                const user = auth.currentUser;
                if (!user) return;

                notesSaveStatus.textContent = 'Saving...';
                const noteRef = doc(db, "notes", user.uid);
                await setDoc(noteRef, { content: notesArea.value, updatedAt: new Date() });
                notesSaveStatus.textContent = 'Saved!';
                setTimeout(() => notesSaveStatus.textContent = '', 2000);
            }

            notesArea.addEventListener('keyup', () => {
                clearTimeout(notesTimeout);
                notesTimeout = setTimeout(saveNotes, 1000);
            });

            onAuthStateChanged(auth, loadNotes);
            loadNotes();
            break;
        case 'scheduler':
            // Scheduler logic
            break;
        case 'focus':
            // Focus timer logic
            break;
        case 'habits':
            let habitsData = JSON.parse(localStorage.getItem('habits')) || ['Workout', 'Read', 'Relax', 'Commit'];
            const habitGrid = document.querySelector('.habit-tracker-grid');
            const addHabitForm = document.getElementById('add-habit-form');

            function saveHabits() {
                localStorage.setItem('habits', JSON.stringify(habitsData));
            }

            function renderHabits() {
                if(!habitGrid) return;
                habitGrid.innerHTML = '';
                habitsData.forEach((habit, habitIndex) => {
                    const habitRow = document.createElement('div');
                    habitRow.className = 'habit-row grid grid-cols-[minmax(120px,1fr)_repeat(7,40px)] items-center gap-2 p-3 bg-gray-50 rounded-lg';
                    habitRow.innerHTML = `<div class="habit-name font-medium">${habit}</div>`;
                    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
                        habitRow.innerHTML += `<input type="checkbox" class="h-6 w-6 justify-self-center rounded border-gray-300 text-blue-500">`;
                    }
                    habitGrid.appendChild(habitRow);
                });
            }

            addHabitForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const newHabitInput = document.getElementById('new-habit-input');
                const newHabit = newHabitInput.value.trim();
                if (newHabit && !habitsData.includes(newHabit)) {
                    habitsData.push(newHabit);
                    saveHabits();
                    renderHabits();
                    newHabitInput.value = '';
                }
            });
            renderHabits();
            break;
        case 'links':
            let quickLinksData = JSON.parse(localStorage.getItem('quickLinks')) || [
                { title: 'Discord', url: 'https://discord.com/app' },
                { title: 'GitHub', url: 'https://github.com' },
            ];
            const linksGrid = document.querySelector('.links-grid');
            const addLinkForm = document.getElementById('add-link-form');

            function saveQuickLinks() {
                localStorage.setItem('quickLinks', JSON.stringify(quickLinksData));
            }

            function renderLinks() {
                if(!linksGrid) return;
                linksGrid.innerHTML = '';
                quickLinksData.forEach((link, index) => {
                    const card = document.createElement('div');
                    card.className = 'relative link-card block p-4 no-underline text-gray-800 bg-gray-50 border border-gray-200 rounded-lg';
                    card.innerHTML = `
                        <a href="${link.url}" target="_blank">
                            <div class="font-bold text-lg mb-1">${link.title}</div>
                            <div class="text-sm text-gray-600 break-all">${link.url}</div>
                        </a>
                        <button class="absolute top-2 right-2 text-red-500 delete-link-btn" data-index="${index}">&times;</button>
                    `;
                    linksGrid.appendChild(card);
                });
            }

            addLinkForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const titleInput = document.getElementById('new-link-title');
                const urlInput = document.getElementById('new-link-url');
                const newLink = { title: titleInput.value.trim(), url: urlInput.value.trim() };
                if (newLink.title && newLink.url) {
                    quickLinksData.push(newLink);
                    saveQuickLinks();
                    renderLinks();
                    titleInput.value = '';
                    urlInput.value = '';
                }
            });

            linksGrid.addEventListener('click', (e) => {
                if (e.target.matches('.delete-link-btn')) {
                    const index = e.target.dataset.index;
                    quickLinksData.splice(index, 1);
                    saveQuickLinks();
                    renderLinks();
                }
            });

            renderLinks();
            break;
        case 'auth':
            const googleSignInBtn = document.getElementById('google-signin-btn');
            const authSignOutBtn = document.getElementById('auth-signout-btn');
            const authStatus = document.getElementById('auth-status');
            const authForm = document.getElementById('auth-form');
            const authLogout = document.getElementById('auth-logout');
            const userEmail = document.getElementById('user-email');

            const { GoogleAuthProvider, signInWithPopup, signOut } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");

            const provider = new GoogleAuthProvider();

            googleSignInBtn.addEventListener('click', () => {
                signInWithPopup(auth, provider)
                    .then((result) => {
                        const user = result.user;
                        authStatus.textContent = 'Signed in successfully!';
                        updateAuthState(user);
                    }).catch((error) => {
                        console.error("Authentication error:", error);
                        authStatus.textContent = `Error: ${error.message}`;
                    });
            });

            authSignOutBtn.addEventListener('click', () => {
                signOut(auth).then(() => {
                    authStatus.textContent = 'Signed out successfully.';
                    updateAuthState(null);
                }).catch((error) => {
                    console.error("Sign out error:", error);
                    authStatus.textContent = `Error: ${error.message}`;
                });
            });

            function updateAuthState(user) {
                if (user) {
                    authForm.style.display = 'none';
                    authLogout.style.display = 'block';
                    userEmail.textContent = user.email;
                } else {
                    authForm.style.display = 'block';
                    authLogout.style.display = 'none';
                    userEmail.textContent = '';
                }
            }

            onAuthStateChanged(auth, (user) => {
                updateAuthState(user);
            });
            break;
    }

    const userStatusDisplay = document.getElementById('user-status-display');

    onAuthStateChanged(auth, (user) => {
        if (user) {
            userStatusDisplay.innerHTML = `Logged in as: ${user.email} | <a href="/auth.html" class="text-blue-500 hover:underline">Manage Account</a>`;
        } else {
            userStatusDisplay.innerHTML = `<a href="/auth.html" class="text-blue-500 hover:underline">Sign In</a>`;
        }
    });
});
