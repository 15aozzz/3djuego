// physics.js - Cinemática y manejo del vehículo
import { houseColliders } from './track.js';

export const carPhysics = {
    position: new THREE.Vector3(0, 0, 0),
    velocity: 0,
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

    // --- SISTEMA DE COLISIONES EXACTO (AABB por casa) ---
    let collision = false;
    const carRadius = 0.4; // Radio del auto reducido para acercarse más a la pared

    for (let i = 0; i < houseColliders.length; i++) {
        const collider = houseColliders[i];
        
        const minX = collider.minX - carRadius;
        const maxX = collider.maxX + carRadius;
        const minZ = collider.minZ - carRadius;
        const maxZ = collider.maxZ + carRadius;

        // Si entramos en el área de LA CASA EXACTA
        if (nextX > minX && nextX < maxX && nextZ > minZ && nextZ < maxZ) {
            collision = true;
            break;
        }
    }

    if (collision) {
        carPhysics.velocity = 0;
        nextX = carPhysics.position.x;
        nextZ = carPhysics.position.z;
    }

    // Límite del mapa de la ciudad (Mundo abierto de 1000x1000)
    if (Math.abs(nextX) > 490) {
        carPhysics.velocity *= 0.5;
        nextX = Math.sign(nextX) * 490;
    }
    if (Math.abs(nextZ) > 490) {
        carPhysics.velocity *= 0.5;
        nextZ = Math.sign(nextZ) * 490;
    }

    carPhysics.position.x = nextX;
    carPhysics.position.z = nextZ;
    carPhysics.position.y = 0; // Terreno plano

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
        playerGroup.rotation.y = carPhysics.heading;
        
        playerGroup.rotation.x = 0;
        playerGroup.rotation.z = 0;
    }
}
