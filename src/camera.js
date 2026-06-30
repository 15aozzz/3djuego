// camera.js - Lógica de cámara rígida tipo arcade

export function updateCamera(camera, carPhysics) {
    // 5. Actualizar Cámara ("Chase Camera" Rígida)
    const cameraOffset = new THREE.Vector3(0, 2.5, 6.5);
    cameraOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), carPhysics.heading);
    
    // Posición estricta
    camera.position.copy(carPhysics.position.clone().add(cameraOffset));
    
    // Mirar directamente hacia el frente de la moto
    const lookAtTarget = carPhysics.position.clone().add(new THREE.Vector3(0, 1.5, 0));
    camera.lookAt(lookAtTarget);
}
