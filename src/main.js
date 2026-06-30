// main.js - Punto de entrada y loop de juego

import { keys, initInput } from './input.js';
import { carPhysics, updatePhysics } from './physics.js';
import { updateCamera } from './camera.js';
import { createTrack, mapData } from './track.js';

let scene, camera, renderer;
let loadedMototaxiModel = null;
let playerGroup = null;
const clock = new THREE.Clock();
let isGameRunning = false;

function init() {
    // Configuración básica
    const canvas = document.getElementById('gameCanvas');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 20, 150);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

    // Iluminación
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(100, 150, 50);
    dirLight.castShadow = true;
    // Ampliar el área de las sombras para que cubra toda la ciudad
    dirLight.shadow.camera.top = 150;
    dirLight.shadow.camera.bottom = -150;
    dirLight.shadow.camera.left = -150;
    dirLight.shadow.camera.right = 150;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    // Entorno modular
    createTrack(scene);

    window.addEventListener('resize', onWindowResize);
    initInput();

    // Cargar Vehículo
    loadModel();

    requestAnimationFrame(animate);
}

function loadModel() {
    const loader = new THREE.GLTFLoader();
    const btn = document.getElementById('startButton');
    
    loader.load('./moto_mid_poly.glb', function(gltf) {
        const model = gltf.scene;
        
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) {
            const scale = 2.6 / maxDim; 
            model.scale.set(scale, scale, scale);
        }
        
        const center = box.getCenter(new THREE.Vector3());
        model.position.set(-center.x * (2.6/maxDim), -box.min.y * (2.6/maxDim), -center.z * (2.6/maxDim));

        model.rotation.y = Math.PI; 
        
        model.traverse(function(child) {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        const wrapper = new THREE.Group();
        wrapper.add(model);
        loadedMototaxiModel = wrapper;
        
        btn.innerText = '¡INICIAR SIMULADOR!';
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
        btn.disabled = false;
        btn.onclick = startGame;
    }, undefined, function(e) { 
        console.error('Error cargando modelo:', e);
    });
}

function startGame() {
    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('gameHUD').classList.remove('hidden');
    
    playerGroup = new THREE.Group();
    const mesh = loadedMototaxiModel.clone();
    playerGroup.add(mesh);
    scene.add(playerGroup);

    // Asegurar que inicie en el centro de la pista y mire hacia la ruta (-Z)
    carPhysics.position.set(0, 0, 0);
    carPhysics.heading = 0;

    isGameRunning = true;
    clock.getDelta();
}

function updateHUD() {
    const kmh = Math.abs(carPhysics.velocity * 3.6); 
    document.getElementById('hudSpeed').innerText = Math.floor(kmh).toString().padStart(2, '0');
    const rpmPercent = (Math.abs(carPhysics.velocity) / carPhysics.maxSpeed) * 100;
    document.getElementById('rpmBar').style.width = rpmPercent + '%';
}

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1); 

    if (isGameRunning) {
        updatePhysics(dt, keys, playerGroup);
        updateCamera(camera, carPhysics);
        
        // --- ACTUALIZAR HUD ---
        const hudSpeed = document.getElementById('hudSpeed');
        const rpmBar = document.getElementById('rpmBar');
        
        if (hudSpeed && rpmBar) {
            const displaySpeed = Math.abs(Math.round(carPhysics.velocity * 3.6));
            hudSpeed.textContent = displaySpeed.toString().padStart(2, '0');
            
            const maxSpeedKmh = carPhysics.maxSpeed * 3.6;
            let rpmPercentage = (displaySpeed / maxSpeedKmh) * 100;
            if (keys.w) rpmPercentage = Math.min(100, rpmPercentage + 20);
            
            rpmBar.style.width = `${Math.max(5, rpmPercentage)}%`;
        }

        // --- ACTUALIZAR MINIMAPA ---
        const mapCanvas = document.getElementById('minimap');
        if (mapCanvas) {
            const ctx = mapCanvas.getContext('2d');
            const s = mapCanvas.width;
            
            // Fondo asfalto
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, s, s);

            // Dibujar las manzanas del barrio
            mapData.forEach(block => {
                // Mapear de -500..500 a 0..160
                const bx = ((block.x + 500) / 1000) * s;
                const bz = ((block.z + 500) / 1000) * s;
                
                // Nuevas propiedades w y h del algoritmo BSP
                const bw = (block.w / 1000) * s;
                const bh = (block.h / 1000) * s;
                
                if (block.type === 'cancha') ctx.fillStyle = '#10b981'; // Verde esmeralda (canchita)
                else if (block.type === 'park') ctx.fillStyle = '#059669'; // Verde oscuro (parque)
                else ctx.fillStyle = '#4b5563'; // Gris medio (Manzana de casas)

                ctx.fillRect(bx - bw/2, bz - bh/2, bw, bh);
            });

            // Dibujar jugador
            const px = ((carPhysics.position.x + 500) / 1000) * s;
            const pz = ((carPhysics.position.z + 500) / 1000) * s;
            
            ctx.fillStyle = '#fbbf24'; // Amarillo (Mototaxi)
            ctx.beginPath();
            ctx.arc(px, pz, 3, 0, Math.PI * 2);
            ctx.fill();

            // Dibujar la dirección de la mirada (Camera/Car heading)
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(px, pz);
            // El eje Z positivo en Three.js es hacia nosotros. 
            ctx.lineTo(px + Math.sin(carPhysics.heading) * 6, pz + Math.cos(carPhysics.heading) * 6);
            ctx.stroke();
        }

        renderer.render(scene, camera);
    } else {
        if (camera && loadedMototaxiModel) {
            const time = Date.now() * 0.0005;
            camera.position.x = Math.sin(time) * 8;
            camera.position.z = Math.cos(time) * 8;
            camera.position.y = 3;
            camera.lookAt(0, 1, 0);
        }
        renderer.render(scene, camera);
    }
}

function onWindowResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

init();
