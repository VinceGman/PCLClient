document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        document.getElementById('settings-menu').classList.toggle('visible');
    }
});

function switchScene(sceneName) {
    document.querySelectorAll('.scene').forEach(scene => {
        scene.classList.remove('active');
    });

    document.getElementById(sceneName).classList.add('active');
}

window.electronAPI.getAppVersion().then(version => {
    document.getElementById("current-version").textContent = `Version ${version}`;
});