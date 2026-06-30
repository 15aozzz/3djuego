// track.js - Generador de Ciudad Plana Asimétrica (Mondrian/BSP)

export function getRoadCenterX(z) { return 0; } // Mantenemos para evitar errores de importación

export const mapData = []; // Para el minimapa

export function createTrack(scene) {
    const size = 1000;

    // 1. TERRENO BASE (Asfalto principal de las pistas 100% plano)
    const groundGeo = new THREE.PlaneGeometry(size, size);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Recursos Reutilizables
    const sharedResources = {
        boxGeo: new THREE.BoxGeometry(1, 1, 1),
        ironGeo: new THREE.CylinderGeometry(0.1, 0.1, 2),
        ironMat: new THREE.MeshBasicMaterial({ color: 0x333333 }),
        roofMat: new THREE.MeshStandardMaterial({ color: 0x777788, roughness: 0.7 }),
        houseMaterials: [
            0xcb6040, 0xcb6040, 0xd1c19b, 0x5a9db6, 0xdfb44a, 0x9ba2a6
        ].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 })),
        grassMat: new THREE.MeshStandardMaterial({ color: 0x3d5e3a, roughness: 1.0 }),
        concreteMat: new THREE.MeshStandardMaterial({ color: 0x889988, roughness: 0.8 }),
        courtMat: new THREE.MeshStandardMaterial({ color: 0x2a5934, roughness: 0.8 }),
        whiteMat: new THREE.MeshBasicMaterial({ color: 0xffffff }),
        treeTrunkMat: new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 }),
        treeLeafMat: new THREE.MeshStandardMaterial({ color: 0x2d4c1e, roughness: 0.8, flatShading: true })
    };

    // 2. ALGORITMO DE PARTICIÓN (BSP) PARA CREAR MANZANAS IRREGULARES
    const roadWidth = 14;
    const minBlock = 30; // Tamaño mínimo de una manzana
    const blocks = [];

    // Función recursiva para cortar la ciudad
    function splitCityBox(x1, z1, x2, z2) {
        const w = x2 - x1;
        const h = z2 - z1;
        
        let canSplitW = w > minBlock * 2 + roadWidth;
        let canSplitH = h > minBlock * 2 + roadWidth;
        
        // Evitamos que divida la zona central inicial (0,0) para que el jugador aparezca libre
        const isInCenter = (-30 < x2 && 30 > x1) && (-30 < z2 && 30 > z1);

        if ((!canSplitW && !canSplitH) || (w * h < 4000 && Math.random() > 0.7)) {
            // No podemos (o decidimos no) seguir cortando. Es una manzana final.
            if (!isInCenter) {
                blocks.push({ x1, z1, x2, z2, w, h, cx: (x1+x2)/2, cz: (z1+z2)/2 });
            }
            return;
        }
        
        let splitH = false; // Cortar horizontalmente (una pista de izquierda a derecha)
        if (canSplitW && canSplitH) {
            splitH = h > w; // Cortar siempre el lado más largo para evitar tiras delgadas
        } else if (canSplitH) {
            splitH = true;
        } else {
            splitH = false;
        }
        
        if (splitH) {
            const minZ = z1 + minBlock + roadWidth/2;
            const maxZ = z2 - minBlock - roadWidth/2;
            const splitZ = minZ + Math.random() * (maxZ - minZ);
            splitCityBox(x1, z1, x2, splitZ - roadWidth/2);
            splitCityBox(x1, splitZ + roadWidth/2, x2, z2);
        } else {
            const minX = x1 + minBlock + roadWidth/2;
            const maxX = x2 - minBlock - roadWidth/2;
            const splitX = minX + Math.random() * (maxX - minX);
            splitCityBox(x1, z1, splitX - roadWidth/2, z2);
            splitCityBox(splitX + roadWidth/2, z1, x2, z2);
        }
    }

    // Empezamos con un gran rectángulo de 900x900 (dejamos un margen de 50 a los lados)
    splitCityBox(-450, -450, 450, 450);

    let canchasCount = 0;
    let parkCount = 0;
    const MAX_CANCHAS = 3;
    const MAX_PARKS = 15;
    
    // Lista para guardar las ubicaciones de las áreas verdes y forzar separación
    const greenZones = [];

    // Mezclar el array de bloques para distribución aleatoria
    const shuffledBlocks = [...blocks].sort(() => Math.random() - 0.5);

    shuffledBlocks.forEach(block => {
        // Verificar si está muy cerca de otro parque o cancha (mínimo 150 metros de separación)
        let isTooClose = false;
        for (const zone of greenZones) {
            const dist = Math.hypot(zone.cx - block.cx, zone.cz - block.cz);
            if (dist < 150) {
                isTooClose = true;
                break;
            }
        }

        if (!isTooClose && canchasCount < MAX_CANCHAS && ((block.w >= 26 && block.h >= 46) || (block.h >= 26 && block.w >= 46))) {
            block.type = 'cancha';
            canchasCount++;
            greenZones.push(block);
        } else if (!isTooClose && parkCount < MAX_PARKS) {
            block.type = 'park';
            parkCount++;
            greenZones.push(block);
        } else {
            block.type = 'house';
        }
    });

    // 3. CONSTRUIR CADA MANZANA ASIMÉTRICA
    blocks.forEach(block => {
        // Vereda base
        const sidewalk = new THREE.Mesh(new THREE.PlaneGeometry(block.w + 2, block.h + 2), sharedResources.concreteMat);
        sidewalk.rotation.x = -Math.PI / 2;
        sidewalk.position.set(block.cx, 0.05, block.cz);
        sidewalk.receiveShadow = true;
        scene.add(sidewalk);

        // Qué pondremos en esta manzana?
        if (block.type === 'cancha') {
            buildCanchita(scene, block, sharedResources);
        } else if (block.type === 'park') {
            buildPark(scene, block, sharedResources);
        } else {
            buildHousesBlock(scene, block, sharedResources);
        }

        mapData.push({ type: block.type, x: block.cx, z: block.cz, w: block.w, h: block.h });
    });
}

function buildHousesBlock(scene, block, res) {
    const houseDepth = 10;
    
    // Llenar la manzana asimétrica fila por fila
    for (let z = block.z1 + houseDepth/2 + 1; z < block.z2 - 1; z += houseDepth) {
        // Si no entra otra fila, terminamos
        if (z + houseDepth/2 > block.z2) break;
        
        let currentX = block.x1 + 1; 
        
        while (currentX < block.x2 - 1) {
            let width = 5 + Math.random() * 4;
            // Recortar la casa si se sale de la cuadra
            if (currentX + width > block.x2 - 1) {
                width = (block.x2 - 1) - currentX;
            }
            if (width < 3) break;

            const houseGroup = new THREE.Group();
            const cx = currentX + width/2;
            houseGroup.position.set(cx, 0.1, z);

            const mat = res.houseMaterials[Math.floor(Math.random() * res.houseMaterials.length)];
            const height = 4 + Math.random() * 5;

            // Primer piso (Medianera total)
            const base = new THREE.Mesh(res.boxGeo, mat);
            base.scale.set(width, height, houseDepth);
            base.position.y = height / 2;
            base.castShadow = true;
            base.receiveShadow = true;
            houseGroup.add(base);

            // Segundo piso a medio terminar
            if (Math.random() > 0.4) {
                const secondHeight = 3 + Math.random() * 2;
                const secondFloor = new THREE.Mesh(res.boxGeo, mat);
                secondFloor.scale.set(width * 0.9, secondHeight, houseDepth * 0.9);
                secondFloor.position.y = height + (secondHeight / 2);
                secondFloor.castShadow = true;
                secondFloor.receiveShadow = true;
                houseGroup.add(secondFloor);
                
                // Fierros
                for(let v = 0; v < 4; v++) {
                    const iron = new THREE.Mesh(res.ironGeo, res.ironMat);
                    iron.position.set((v%2===0 ? 1 : -1)*(width*0.4), height + secondHeight + 1, (v<2 ? 1 : -1)*(houseDepth*0.4));
                    houseGroup.add(iron);
                }
            }

            // Techo calamina
            if (Math.random() > 0.5) {
                const roof = new THREE.Mesh(res.boxGeo, res.roofMat);
                roof.scale.set(width * 1.05, 0.2, houseDepth * 1.05);
                const totalH = houseGroup.children.reduce((max, c) => Math.max(max, c.position.y + c.scale.y/2 || 0), 0);
                roof.position.y = totalH + 0.1;
                roof.rotation.x = 0.05; 
                roof.castShadow = true;
                houseGroup.add(roof);
            }

            scene.add(houseGroup);
            currentX += width;
        }
    }
}

function buildPark(scene, block, res) {
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(block.w - 2, block.h - 2), res.grassMat);
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(block.cx, 0.1, block.cz);
    grass.receiveShadow = true;
    scene.add(grass);

    // Árboles en el área irregular del parque
    const area = block.w * block.h;
    const numTrees = Math.floor(area / 150); // Densidad según el tamaño
    const treeGeo = new THREE.IcosahedronGeometry(1.5, 1);
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.4, 3);

    for (let k = 0; k < numTrees; k++) {
        const tx = block.x1 + 2 + Math.random() * (block.w - 4);
        const tz = block.z1 + 2 + Math.random() * (block.h - 4);
        
        const trunk = new THREE.Mesh(trunkGeo, res.treeTrunkMat);
        trunk.position.set(tx, 1.5, tz);
        trunk.castShadow = true;
        scene.add(trunk);

        const leaves = new THREE.Mesh(treeGeo, res.treeLeafMat);
        leaves.position.set(tx, 3 + Math.random(), tz);
        leaves.scale.setScalar(1 + Math.random() * 0.5);
        leaves.castShadow = true;
        scene.add(leaves);
    }
}

function buildCanchita(scene, block, res) {
    const isRotated = block.w > block.h;
    const courtWidth = isRotated ? 40 : 20;
    const courtLength = isRotated ? 20 : 40;

    const court = new THREE.Mesh(new THREE.PlaneGeometry(courtWidth, courtLength), res.courtMat);
    court.rotation.x = -Math.PI / 2;
    court.position.set(block.cx, 0.1, block.cz);
    court.receiveShadow = true;
    scene.add(court);

    // Línea central
    const centerLine = new THREE.Mesh(new THREE.PlaneGeometry(isRotated ? 0.5 : courtWidth, isRotated ? courtLength : 0.5), res.whiteMat);
    centerLine.rotation.x = -Math.PI / 2;
    centerLine.position.set(block.cx, 0.11, block.cz);
    scene.add(centerLine);

    const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 2.5);
    const crossGeo = new THREE.CylinderGeometry(0.1, 0.1, 6);
    const goalMat = new THREE.MeshStandardMaterial({ color: 0xdddddd });

    [-1, 1].forEach(side => {
        const p1 = new THREE.Mesh(postGeo, goalMat);
        const p2 = new THREE.Mesh(postGeo, goalMat);
        const cross = new THREE.Mesh(crossGeo, goalMat);

        if (isRotated) {
            const xOffset = block.cx + side * (courtWidth / 2);
            p1.position.set(xOffset, 1.25, block.cz - 3);
            p2.position.set(xOffset, 1.25, block.cz + 3);
            cross.rotation.x = Math.PI / 2;
            cross.position.set(xOffset, 2.5, block.cz);
        } else {
            const zOffset = block.cz + side * (courtLength / 2);
            p1.position.set(block.cx - 3, 1.25, zOffset);
            p2.position.set(block.cx + 3, 1.25, zOffset);
            cross.rotation.z = Math.PI / 2;
            cross.position.set(block.cx, 2.5, zOffset);
        }

        p1.castShadow = true; p2.castShadow = true; cross.castShadow = true;
        scene.add(p1); scene.add(p2); scene.add(cross);
    });
}
