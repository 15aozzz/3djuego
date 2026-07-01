// physics.js - Cinemática y manejo del vehículo
import * as THREE from 'https://cdn.skypack.dev/three@0.132.2';
import { loadedEnvironmentMap } from './main.js';
import { houseColliders, getTerrainHeight } from './track.js';

export const carPhysics = {
    position: new THREE.Vector3(0, 0, 0),
    velocity: 0,
    velocityY: 0,
    maxSpeed: 30,       // m/s
    maxReverseSpeed: -10, // m/s
    acceleration: 15,   // m/s^2
    braking: 30,        // m/s^2
    friction: 4,        // Fricción pasiva
    heading: 0,         // Yaw en radianes
    steeringAngle: 0    // Ángulo suavizado del timón
};

export function updatePhysics(dt, keys, playerGroup) {
    // 1. Aceleración / Frenado
    if (keys.w) {
        carPhysics.velocity += carPhysics.acceleration * dt;
    } else if (keys.s) {
        carPhysics.velocity -= carPhysics.braking * dt;
    } else {
        if (carPhysics.velocity > 0) {
            carPhysics.velocity = Math.max(0, carPhysics.velocity - carPhysics.friction * dt);
        } else if (carPhysics.velocity < 0) {
            carPhysics.velocity = Math.min(0, carPhysics.velocity + carPhysics.friction * dt);
        }
    }

    if (carPhysics.velocity > carPhysics.maxSpeed) carPhysics.velocity = carPhysics.maxSpeed;
    if (carPhysics.velocity < carPhysics.maxReverseSpeed) carPhysics.velocity = carPhysics.maxReverseSpeed;

    // 2. Dirección
    let steerDirection = 0;
    if (keys.a) steerDirection = 1;  // Izquierda
    if (keys.d) steerDirection = -1; // Derecha

    carPhysics.steeringAngle += (steerDirection - carPhysics.steeringAngle) * 8 * dt;

    if (Math.abs(carPhysics.velocity) > 0.5) {
        const directionMultiplier = carPhysics.velocity > 0 ? 1 : -1;
        const baseTurnSpeed = 2.5; 
        const speedFactor = Math.abs(carPhysics.velocity) / carPhysics.maxSpeed;
        const handlingGrip = Math.max(0.4, 1.0 - (speedFactor * 0.4));

        carPhysics.heading += carPhysics.steeringAngle * baseTurnSpeed * handlingGrip * directionMultiplier * dt;
    }

    // 3. Movimiento Vectorial
    const moveDirection = new THREE.Vector3(0, 0, -1);
    moveDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), carPhysics.heading);
    
    let nextX = carPhysics.position.x + moveDirection.x * carPhysics.velocity * dt;
    let nextZ = carPhysics.position.z + moveDirection.z * carPhysics.velocity * dt;

    // --- SISTEMA DE COLISIONES HÍBRIDO ---
    let collision = false;
    const carRadius = 0.4;

    if (!keys.c) { // Ignorar colisión si está en modo fantasma
        // 1. Colisiones con la Ciudad Procedural (AABB rápido)
        for (let i = 0; i < houseColliders.length; i++) {
            const collider = houseColliders[i];
            const minX = collider.minX - carRadius;
            const maxX = collider.maxX + carRadius;
            const minZ = collider.minZ - carRadius;
            const maxZ = collider.maxZ + carRadius;

            if (nextX > minX && nextX < maxX && nextZ > minZ && nextZ < maxZ) {
                collision = true;
                break;
            }
        }

        // 2. Colisiones con el Mapa 3D (Raycasting preciso)
        if (!collision && loadedEnvironmentMap && Math.abs(carPhysics.velocity) > 0.1) {
            const velDir = moveDirection.clone().multiplyScalar(Math.sign(carPhysics.velocity)).normalize();
            const rightDir = new THREE.Vector3(-velDir.z, 0, velDir.x);
            
            const origins = [
                new THREE.Vector3(carPhysics.position.x, 0.5, carPhysics.position.z),
                new THREE.Vector3(carPhysics.position.x + rightDir.x * 0.8, 0.5, carPhysics.position.z + rightDir.z * 0.8),
                new THREE.Vector3(carPhysics.position.x - rightDir.x * 0.8, 0.5, carPhysics.position.z - rightDir.z * 0.8)
            ];
            
            for (let origin of origins) {
                const raycaster = new THREE.Raycaster(origin, velDir, 0, 1.2);
                const intersects = raycaster.intersectObject(loadedEnvironmentMap, true);
                if (intersects.length > 0) {
                    collision = true;
                    break;
                }
            }
        }
    }

    if (collision) {
        carPhysics.velocity = 0;
        nextX = carPhysics.position.x;
        nextZ = carPhysics.position.z;
    }

    // --- LÍMITES DEL MUNDO EXPANDIDOS ---
    // Expandimos el límite Z al norte (-2000) para incluir el nuevo mapa 3D
    if (Math.abs(nextX) > 490) {
        carPhysics.velocity *= 0.5;
        nextX = Math.sign(nextX) * 490;
    }
    if (nextZ > 490) { // Límite sur
        carPhysics.velocity *= 0.5;
        nextZ = 490;
    }
    if (nextZ < -1500) { // Límite norte extendido
        carPhysics.velocity *= 0.5;
        nextZ = -1500;
    }

    carPhysics.position.x = nextX;
    carPhysics.position.z = nextZ;
    
    // --- GRAVEDAD Y DETECCIÓN DE SUELO ---
    if (!keys.c) {
        carPhysics.velocityY -= 25 * dt; // Gravedad (m/s^2)
    } else {
        carPhysics.velocityY = 0; // Volar/Levitar en modo fantasma
    }
    
    let nextY = carPhysics.position.y + carPhysics.velocityY * dt;

    const groundY = getTerrainHeight(nextX, nextZ);

    if (!keys.c && nextY <= groundY) {
        nextY = groundY;
        carPhysics.velocityY = 0;
    }

    carPhysics.position.y = nextY;

    if (playerGroup) {
        // Rotación de las ruedas
        const speedFactor = carPhysics.velocity * dt * 2.0;
        playerGroup.children.forEach(child => {
            if (child.name.includes("Wheel")) {
                child.rotation.x += speedFactor;
                if (child.name.includes("Front")) {
                    child.rotation.y = carPhysics.steeringAngle;
                }
            }
        });

        // Aplicar transformaciones al Grupo
        playerGroup.position.copy(carPhysics.position);
        playerGroup.rotation.order = 'YXZ'; // Primero heading, luego pitch, luego roll
        playerGroup.rotation.y = carPhysics.heading;
        
        // Calcular pendiente visual (pitch y roll) consultando el terreno
        const localForward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), carPhysics.heading);
        const frontY = getTerrainHeight(carPhysics.position.x + localForward.x * 1.5, carPhysics.position.z + localForward.z * 1.5);
        const backY = getTerrainHeight(carPhysics.position.x - localForward.x * 1.5, carPhysics.position.z - localForward.z * 1.5);
        
        const localRight = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), carPhysics.heading);
        const rightY = getTerrainHeight(carPhysics.position.x + localRight.x * 1.0, carPhysics.position.z + localRight.z * 1.0);
        const leftY = getTerrainHeight(carPhysics.position.x - localRight.x * 1.0, carPhysics.position.z - localRight.z * 1.0);

        // pitch (X) positivo = nariz hacia ARRIBA. Subida (frontY > backY) -> Pitch debe ser positivo.
        // pitch = frontY - backY
        const pitch = Math.atan2(frontY - backY, 3.0);
        
        // roll (Z) positivo = inclinación hacia la izquierda (sube lado derecho). 
        // Si rightY > leftY, roll debe ser positivo.
        // roll = rightY - leftY
        const roll = Math.atan2(rightY - leftY, 2.0);
        
        playerGroup.rotation.x = pitch;
        playerGroup.rotation.z = roll;
    }
}
