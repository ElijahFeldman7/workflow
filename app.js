document.addEventListener('DOMContentLoaded', async function() {
    const page = document.body.dataset.page;

    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
    const { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
    const { getFirestore, collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc, getDoc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");

    const firebaseConfig = {
        apiKey: "YOUR_API_KEY",
        authDomain: "YOUR_AUTH_DOMAIN",
        projectId: "YOUR_PROJECT_ID",
        storageBucket: "YOUR_STORAGE_BUCKET",
        messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
        appId: "YOUR_APP_ID"
    };

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

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
            const scheduleGrid = document.querySelector('.schedule-grid');

            async function renderSchedule() {
                if (!scheduleGrid) return;
                scheduleGrid.innerHTML = '';
                const user = auth.currentUser;

                for (let hour = 0; hour < 24; hour++) {
                    const timeCell = document.createElement('div');
                    timeCell.className = 'time-cell p-2 border-r border-b border-gray-200 text-right';
                    timeCell.textContent = `${hour}:00`;
                    scheduleGrid.appendChild(timeCell);

                    const eventCell = document.createElement('div');
                    eventCell.className = 'event-cell p-2 border-b border-gray-200';
                    eventCell.dataset.hour = hour;
                    scheduleGrid.appendChild(eventCell);
                }

                if (user) {
                    const q = query(collection(db, "schedule"), where("userId", "==", user.uid));
                    const querySnapshot = await getDocs(q);
                    querySnapshot.forEach((doc) => {
                        const event = doc.data();
                        const eventHour = new Date(event.startTime.seconds * 1000).getHours();
                        const eventCell = scheduleGrid.querySelector(`.event-cell[data-hour="${eventHour}"]`);
                        if (eventCell) {
                            const eventDiv = document.createElement('div');
                            eventDiv.className = 'bg-blue-100 p-1 rounded';
                            eventDiv.textContent = event.title;
                            eventCell.appendChild(eventDiv);
                        }
                    });
                }
            }

            scheduleGrid.addEventListener('click', async (e) => {
                if (e.target.matches('.event-cell')) {
                    const hour = e.target.dataset.hour;
                    const title = prompt("Enter event title:");
                    if (title) {
                        const user = auth.currentUser;
                        if (user) {
                            const now = new Date();
                            const startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0);
                            await addDoc(collection(db, "schedule"), { title, startTime, userId: user.uid });
                            renderSchedule();
                        }
                    }
                }
            });

            onAuthStateChanged(auth, renderSchedule);
            renderSchedule();
            break;
        case 'focus':
            const timerDisplay = document.getElementById('timer-display');
            const startBtn = document.getElementById('start-timer-btn');
            const stopBtn = document.getElementById('stop-timer-btn');
            const resetBtn = document.getElementById('reset-timer-btn');
            const timerStatus = document.getElementById('timer-status');

            let timer;
            let timeLeft = 25 * 60;

            function updateTimerDisplay() {
                const minutes = Math.floor(timeLeft / 60);
                const seconds = timeLeft % 60;
                timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }

            function startTimer() {
                timerStatus.textContent = 'Time to focus!';
                timer = setInterval(() => {
                    timeLeft--;
                    updateTimerDisplay();
                    if (timeLeft === 0) {
                        clearInterval(timer);
                        timerStatus.textContent = 'Good work! Take a break.';
                    }
                }, 1000);
            }

            function stopTimer() {
                clearInterval(timer);
            }

            function resetTimer() {
                clearInterval(timer);
                timeLeft = 25 * 60;
                updateTimerDisplay();
                timerStatus.textContent = 'Get back to Work!';
            }

            startBtn.addEventListener('click', startTimer);
            stopBtn.addEventListener('click', stopTimer);
            resetBtn.addEventListener('click', resetTimer);

            updateTimerDisplay();
            break;
        case 'habits':
            const habitGrid = document.querySelector('.habit-tracker-grid');
            const addHabitForm = document.getElementById('add-habit-form');

            async function renderHabits() {
                if (!habitGrid) return;
                habitGrid.innerHTML = '';
                const user = auth.currentUser;
                if (user) {
                    const q = query(collection(db, "habits"), where("userId", "==", user.uid));
                    const querySnapshot = await getDocs(q);
                    const habits = [];
                    querySnapshot.forEach((doc) => habits.push({ id: doc.id, ...doc.data() }));

                    habits.forEach((habit) => {
                        const habitRow = document.createElement('div');
                        habitRow.className = 'habit-row grid grid-cols-[minmax(120px,1fr)_repeat(7,40px)] items-center gap-2 p-3 bg-gray-50 rounded-lg';
                        habitRow.innerHTML = `<div class="habit-name font-medium">${habit.name}</div>`;
                        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
                            const checkbox = document.createElement('input');
                            checkbox.type = 'checkbox';
                            checkbox.className = 'h-6 w-6 justify-self-center rounded border-gray-300 text-blue-500';
                            checkbox.dataset.habitId = habit.id;
                            checkbox.dataset.dayIndex = dayIndex;
                            checkbox.checked = habit.days && habit.days[dayIndex];
                            habitRow.appendChild(checkbox);
                        }
                        habitGrid.appendChild(habitRow);
                    });
                } else {
                    habitGrid.innerHTML = '<p class="text-center text-gray-500">Please sign in to track your habits.</p>';
                }
            }

            addHabitForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const newHabitInput = document.getElementById('new-habit-input');
                const newHabit = newHabitInput.value.trim();
                const user = auth.currentUser;
                if (newHabit && user) {
                    await addDoc(collection(db, "habits"), { name: newHabit, userId: user.uid, days: Array(7).fill(false) });
                    newHabitInput.value = '';
                    renderHabits();
                }
            });

            habitGrid.addEventListener('change', async (e) => {
                if (e.target.matches('input[type="checkbox"]')) {
                    const { habitId, dayIndex } = e.target.dataset;
                    const habitRef = doc(db, "habits", habitId);
                    const habitSnap = await getDoc(habitRef);
                    if (habitSnap.exists()) {
                        const habit = habitSnap.data();
                        habit.days[dayIndex] = e.target.checked;
                        await updateDoc(habitRef, { days: habit.days });
                    }
                }
            });

            onAuthStateChanged(auth, renderHabits);
            renderHabits();
            break;
        case 'links':
            const linksGrid = document.querySelector('.links-grid');
            const addLinkForm = document.getElementById('add-link-form');

            async function renderLinks() {
                if (!linksGrid) return;
                linksGrid.innerHTML = '';
                const user = auth.currentUser;
                if (user) {
                    const q = query(collection(db, "links"), where("userId", "==", user.uid));
                    const querySnapshot = await getDocs(q);
                    const links = [];
                    querySnapshot.forEach((doc) => links.push({ id: doc.id, ...doc.data() }));

                    links.forEach((link) => {
                        const card = document.createElement('div');
                        card.className = 'relative link-card block p-4 no-underline text-gray-800 bg-gray-50 border border-gray-200 rounded-lg';
                        card.innerHTML = `
                            <a href="${link.url}" target="_blank">
                                <div class="font-bold text-lg mb-1">${link.title}</div>
                                <div class="text-sm text-gray-600 break-all">${link.url}</div>
                            </a>
                            <button class="absolute top-2 right-2 text-red-500 delete-link-btn" data-id="${link.id}">&times;</button>
                        `;
                        linksGrid.appendChild(card);
                    });
                } else {
                    linksGrid.innerHTML = '<p class="text-center text-gray-500">Please sign in to manage your links.</p>';
                }
            }

            addLinkForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const titleInput = document.getElementById('new-link-title');
                const urlInput = document.getElementById('new-link-url');
                const newLink = { title: titleInput.value.trim(), url: urlInput.value.trim() };
                const user = auth.currentUser;
                if (newLink.title && newLink.url && user) {
                    await addDoc(collection(db, "links"), { ...newLink, userId: user.uid });
                    titleInput.value = '';
                    urlInput.value = '';
                    renderLinks();
                }
            });

            linksGrid.addEventListener('click', async (e) => {
                if (e.target.matches('.delete-link-btn')) {
                    const id = e.target.dataset.id;
                    await deleteDoc(doc(db, "links", id));
                    renderLinks();
                }
            });

            onAuthStateChanged(auth, renderLinks);
            renderLinks();
            break;
        case 'auth':
            const googleSignInBtn = document.getElementById('google-signin-btn');
            const authSignOutBtn = document.getElementById('auth-signout-btn');
            const authStatus = document.getElementById('auth-status');
            const authForm = document.getElementById('auth-form');
            const authLogout = document.getElementById('auth-logout');
            const userEmail = document.getElementById('user-email');

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