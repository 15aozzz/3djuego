let _seed = 12345; function seededRandom() { _seed = (_seed * 9301 + 49297) % 233280; return _seed / 233280; }

// track.js - Generador de Ciudad Plana Asimétrica (Mondrian/BSP)

export function getRoadCenterX(z) { return 0; } // Mantenemos para evitar errores de importación

export const mapData = []; // Para el minimapa
export const houseColliders = []; // Para colisiones exactas con las paredes

// Función para obtener la elevación del terreno en cualquier punto (SISTEMA DE TERRAZAS)
export function getTerrainHeight(x, z) {
    if (z >= -85) return 0; // Zona sur plana
    if (z < -85 && z >= -125) return ((-85 - z) / 40) * 15; // Rampa 1
    if (z < -125 && z >= -165) return 15; // Terraza 1
    if (z < -165 && z >= -205) return 15 + ((-165 - z) / 40) * 15; // Rampa 2
    if (z < -205 && z >= -245) return 30; // Terraza 2
    if (z < -245 && z >= -285) return 30 + ((-245 - z) / 40) * 15; // Rampa 3
    return 45; // Cima plana
}

export function createTrack(scene) {
    const size = 1000;

    // 1. TERRENO BASE (Asfalto principal modificado para el cerro)
    const groundGeo = new THREE.PlaneGeometry(size, size, 150, 150);
    const pos = groundGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vy = pos.getY(i);
        // Plane se crea en plano XY, al rotar -90 en X, Y de plane pasa a ser -Z del mundo
        const worldZ = -vy;
        const elev = getTerrainHeight(vx, worldZ);
        pos.setZ(i, elev); // Z del plane se convierte en Y del mundo
    }
    groundGeo.computeVertexNormals();
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
        // Ya no usamos array de materiales individuales, usamos colores puros e InstancedMaterial
        houseColors: [
            new THREE.Color(0xd87a5d), // Naranja ladrillo pintado (no fosforescente)
            new THREE.Color(0xd4b85c), // Amarillo mostaza / colonial
            new THREE.Color(0x5d9bb0), // Celeste clásico
            new THREE.Color(0x7bb062), // Verde manzana suave
            new THREE.Color(0xc282a5), // Rosado pálido
            new THREE.Color(0x8c8c8c)  // Gris cemento (casas a medio pintar)
        ],
        instancedHouseMat: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
        brickMat: new THREE.MeshStandardMaterial({ map: createBrickTexture(), roughness: 1.0 }),
        doorMat: new THREE.MeshStandardMaterial({ map: createDoorTexture(), roughness: 0.6, metalness: 0.5 }),
        windowMat: new THREE.MeshStandardMaterial({ map: createWindowTexture(), roughness: 0.2, metalness: 0.8 }),
        frontGeo: new THREE.PlaneGeometry(1, 1),
        doorGeo: new THREE.PlaneGeometry(1, 1),
        tankGeo: new THREE.CylinderGeometry(0.4, 0.4, 1.2, 8),
        tankMat: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 }),
        grassMat: new THREE.MeshStandardMaterial({ color: 0x3d5e3a, roughness: 1.0 }),
        concreteMat: new THREE.MeshStandardMaterial({ map: createSidewalkTexture(), roughness: 0.9 }),
        pircaMat: new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 1.0 }), // Cimiento sólido sin textura de vereda
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

        if ((!canSplitW && !canSplitH) || (w * h < 4000 && seededRandom() > 0.7)) {
            if (!isInCenter) {
                blocks.push({ x1, z1, x2, z2, w, h, cx: (x1+x2)/2, cz: (z1+z2)/2 });
            }
            return;
        }
        
        let splitH = false; 
        if (canSplitW && canSplitH) {
            splitH = h > w; 
        } else if (canSplitH) {
            splitH = true;
        } else {
            splitH = false;
        }
        
        if (splitH) {
            const minZ = z1 + minBlock + roadWidth/2;
            const maxZ = z2 - minBlock - roadWidth/2;
            const splitZ = minZ + seededRandom() * (maxZ - minZ);
            splitCityBox(x1, z1, x2, splitZ - roadWidth/2);
            splitCityBox(x1, splitZ + roadWidth/2, x2, z2);
        } else {
            const minX = x1 + minBlock + roadWidth/2;
            const maxX = x2 - minBlock - roadWidth/2;
            const splitX = minX + seededRandom() * (maxX - minX);
            splitCityBox(x1, z1, splitX - roadWidth/2, z2);
            splitCityBox(splitX + roadWidth/2, z1, x2, z2);
    }
}

    // Dividir la ciudad en ZONAS DE TERRAZAS Y RAMPAS
    // Los bloques dejan 10m de pista entre ellos.
    
    // 1. Zona Sur (Nivel 0)
    splitCityBox(-450, -75, 450, 450); 
    
    // Función para crear bloques únicamente verticales en las rampas
    function splitRamp(x1, z1, x2, z2) {
        const w = x2 - x1;
        if (w > minBlock * 2 + roadWidth) {
            const minX = x1 + minBlock + roadWidth/2;
            const maxX = x2 - minBlock - roadWidth/2;
            const splitX = minX + seededRandom() * (maxX - minX);
            splitRamp(x1, z1, splitX - roadWidth/2, z2);
            splitRamp(splitX + roadWidth/2, z1, x2, z2);
        } else {
            blocks.push({ x1, z1, x2, z2, w, h: z2-z1, cx: (x1+x2)/2, cz: (z1+z2)/2, type: 'ramp_house' });
        }
    }

    // 2. Rampa 1
    splitRamp(-450, -125, 450, -85);

    // 3. Terraza 1 (Nivel 1, elev=15)
    splitCityBox(-450, -155, 450, -135);

    // 4. Rampa 2
    splitRamp(-450, -205, 450, -165);

    // 5. Terraza 2 (Nivel 2, elev=30)
    splitCityBox(-450, -235, 450, -215);

    // 6. Rampa 3
    splitRamp(-450, -285, 450, -245);

    // 7. Zona Norte (Cima plana, Nivel 3, elev=45)
    splitCityBox(-450, -450, 450, -295); 

    // Añadir Plaza Central en el hueco dejado en (0,0) de la Zona Sur
    blocks.push({ x1: -25, z1: -25, x2: 25, z2: 25, w: 50, h: 50, cx: 0, cz: 0, type: 'plaza' });

    let canchasCount = 0;
    let parkCount = 0;
    const MAX_CANCHAS = 3;
    const MAX_PARKS = 15;
    
    const greenZones = [];
    const shuffledBlocks = [...blocks].sort(() => seededRandom() - 0.5);

    shuffledBlocks.forEach(block => {
        if (block.type === 'plaza' || block.type === 'ramp_house') return; // No sobreescribir

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

    // Estructura de datos para InstancedMesh
    const houseData = { brickBases: [], paintedBases: [], foundations: [], fronts: [], seconds: [], brickSeconds: [], roofs: [], irons: [], tanks: [], doors: [], windows: [] };

    // 3. CONSTRUIR CADA MANZANA ASIMÉTRICA
    blocks.forEach(block => {
        if (block.type === 'ramp_house') {
            buildRampHouses(scene, block, houseData, sharedResources);
            mapData.push({ type: block.type, x: block.cx, z: block.cz, w: block.w, h: block.h });
            return; // No construimos vereda plana normal
        }

        const swGeo = new THREE.PlaneGeometry(block.w + 2, block.h + 2);
        const uvs = swGeo.attributes.uv.array;
        for (let i = 0; i < uvs.length; i += 2) {
            uvs[i] *= (block.w + 2) / 4;   
            uvs[i+1] *= (block.h + 2) / 4;
        }
        
        const elev = getTerrainHeight(block.cx, block.cz);
        const sidewalk = new THREE.Mesh(swGeo, sharedResources.concreteMat);
        sidewalk.rotation.x = -Math.PI / 2;
        sidewalk.position.set(block.cx, elev + 0.05, block.cz);
        sidewalk.receiveShadow = true;
        scene.add(sidewalk);

        if (block.type === 'cancha') {
            buildCanchita(scene, block, sharedResources);
        } else if (block.type === 'park') {
            buildPark(scene, block, sharedResources);
        } else if (block.type === 'plaza') {
            buildPlaza(scene, block, sharedResources);
        } else {
            buildHousesBlock(houseData, block, sharedResources);
        }

        mapData.push({ type: block.type, x: block.cx, z: block.cz, w: block.w, h: block.h });
    });

    // 4. GENERAR INSTANCED MESHES
    flushInstancedHouses(scene, sharedResources, houseData);
}

// Construye casas en las laderas con base inclinada
function buildRampHouses(scene, block, houseData, res) {
    const swGeo = new THREE.PlaneGeometry(block.w + 2, block.h + 2);
    const uvs = swGeo.attributes.uv.array;
    for (let i = 0; i < uvs.length; i += 2) {
        uvs[i] *= (block.w + 2) / 4;   
        uvs[i+1] *= (block.h + 2) / 4;
    }
    
    // Calculamos la inclinación (pitch) en el eje Z
    const elevNorth = getTerrainHeight(block.cx, block.z1); 
    const elevSouth = getTerrainHeight(block.cx, block.z2); 
    const diff = elevNorth - elevSouth;
    
    // No dibujamos vereda plana ni inclinada, dejamos que las casas
    // se asienten directamente sobre el terreno natural (cerro).

    // Casas (cuadradas para evitar choques al rotar, igual que en rampas)
    const houseSize = 6;
    const houseWidth = houseSize;
    const houseDepth = houseSize;
    const cols = Math.floor((block.w - 2) / houseWidth);
    // Añadimos espacio para asegurar que quepan sin pasarse
    const rows = Math.floor(block.h / houseDepth);
    const startX = block.cx - block.w / 2 + 1 + houseWidth / 2;
    // Empezar exactamente en el borde sur para que la primera casa esté al ras de la zona plana
    const startZ = block.z2 - houseDepth / 2; 
    
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            const px = startX + i * houseWidth;
            const pz = startZ - j * houseDepth; // Ir subiendo hacia el norte (-Z)
            // Para decidir hacia donde mira, igual que en zona plana:
            let rotY = 0;
            const distN = Math.abs(pz - block.z1);
            const distS = Math.abs(pz - block.z2);
            const distE = Math.abs(px - block.x1);
            const distW = Math.abs(px - block.x2);
            const min = Math.min(distN, distS, distE, distW);
            
            if (min === distN) rotY = Math.PI; // Mira al norte
            else if (min === distS) rotY = 0;
            else if (min === distE) rotY = -Math.PI / 2;
            else if (min === distW) rotY = Math.PI / 2;
            else rotY = seededRandom() > 0.5 ? 0 : Math.PI; // Adentro

            // Cimiento extra largo en rampas: extension = 30
            addHouse(houseData, res, px, pz, houseWidth, houseDepth, rotY, 30);
        }
    }
}

// Función auxiliar para construir UNA casa mirando hacia una dirección (yaw)
function addHouse(houseData, res, cx, z, width, houseDepth, rotationY, customExtension = 10) {
    let boundW = Math.abs(Math.cos(rotationY)) > 0.5 ? width : houseDepth;
    let boundD = Math.abs(Math.cos(rotationY)) > 0.5 ? houseDepth : width;
    
    // Calculamos la elevación en el borde más alto (Norte, -Z)
    // para que la casa quede apoyada sobre el cerro y el cimiento baje.
    const uphillZ = z - boundD / 2;
    const elev = getTerrainHeight(cx, uphillZ);
    
    const extension = customExtension;
    const dummy = new THREE.Object3D();
    
    const colorIndex = Math.floor(seededRandom() * res.houseColors.length);
    const height = 4 + seededRandom() * 5;
    let totalH = height;

    const styleRoll = seededRandom();
    let isPainted = styleRoll < 0.3; 
    let isHybrid = styleRoll >= 0.3 && styleRoll < 0.9; 
    let isBrick = styleRoll >= 0.9; 

    // Base volume
    dummy.position.set(cx, elev + 0.1 + height / 2, z);
    dummy.scale.set(width, height, houseDepth);
    dummy.rotation.set(0, rotationY, 0); 
    dummy.updateMatrix();
    
    if (isPainted) {
        houseData.paintedBases.push({ matrix: dummy.matrix.clone(), colorIndex });
    } else {
        houseData.brickBases.push({ matrix: dummy.matrix.clone() });
    }

    // Cimientos separados para no estirar la casa (pircas de soporte)
    if (extension > 0) {
        dummy.position.set(cx, elev + 0.1 - extension / 2, z);
        dummy.scale.set(width, extension, houseDepth);
        dummy.rotation.set(0, rotationY, 0);
        dummy.updateMatrix();
        houseData.foundations.push({ matrix: dummy.matrix.clone() });
    }

    // Calcular vector 'front' y 'right' basados en la rotación
    const dir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0,1,0), rotationY);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0,1,0), rotationY);

    if (isHybrid) {
        // Fachada al frente
        dummy.position.copy(new THREE.Vector3(cx, elev + 0.1 + height/2, z).addScaledVector(dir, houseDepth/2 + 0.05));
        dummy.scale.set(width, height, 1);
        dummy.rotation.set(0, rotationY, 0);
        dummy.updateMatrix();
        houseData.fronts.push({ matrix: dummy.matrix.clone(), colorIndex });
    }

    // Puerta y ventana
    const layoutType = seededRandom();
    let doorOffset = 0;
    let windowOffset = 0;
    let hasWindow = width > 4.5 && seededRandom() > 0.2; 
    
    if (hasWindow) {
        if (layoutType > 0.5) {
            doorOffset = -1.2;
            windowOffset = 1.2;
        } else {
            doorOffset = 1.2;
            windowOffset = -1.2;
        }
    }

    // Puerta frontal
    const dx = dir.x * (houseDepth/2 + 0.07) + right.x * doorOffset;
    const dz = dir.z * (houseDepth/2 + 0.07) + right.z * doorOffset;
    const doorX = cx + dx;
    const doorZ = z + dz;
    const doorElev = getTerrainHeight(doorX, doorZ);
    
    let doorPos = new THREE.Vector3(doorX, doorElev + 0.1 + 2.4/2, doorZ);
    dummy.position.copy(doorPos);
    dummy.scale.set(1.8, 2.4, 1);
    dummy.rotation.set(0, rotationY, 0); 
    dummy.updateMatrix();
    houseData.doors.push({ matrix: dummy.matrix.clone() });

    // Ventana 1er piso
    if (hasWindow) {
        const wx = dir.x * (houseDepth/2 + 0.07) + right.x * windowOffset;
        const wz = dir.z * (houseDepth/2 + 0.07) + right.z * windowOffset;
        const winX = cx + wx;
        const winZ = z + wz;
        const winElev = getTerrainHeight(winX, winZ);

        let winPos = new THREE.Vector3(winX, winElev + 0.1 + 1.6, winZ);
        dummy.position.copy(winPos);
        dummy.scale.set(1.5, 1.2, 1);
        dummy.rotation.set(0, rotationY, 0);
        dummy.updateMatrix();
        houseData.windows.push({ matrix: dummy.matrix.clone() });
    }

    // Colisiones matemáticas precisas para AABB (Ajustando W y D según la rotación)
    houseColliders.push({
        minX: cx - boundW / 2,
        maxX: cx + boundW / 2,
        minZ: z - boundD / 2,
        maxZ: z + boundD / 2
    });

    // Segundo piso
    const hasSecondFloor = seededRandom() > 0.4;
    if (hasSecondFloor) {
        const secondHeight = 3 + seededRandom() * 2;
        dummy.position.set(cx, elev + 0.1 + height + (secondHeight / 2), z);
        dummy.scale.set(width * 0.9, secondHeight, houseDepth * 0.9);
        dummy.rotation.set(0, rotationY, 0);
        dummy.updateMatrix();
        
        if (seededRandom() < 0.9) {
            houseData.brickSeconds.push({ matrix: dummy.matrix.clone() });
        } else {
            houseData.seconds.push({ matrix: dummy.matrix.clone(), colorIndex });
        }
        
        // Ventana segundo piso
        const secWindowOffset = (seededRandom() > 0.5 ? 1 : -1) * (seededRandom() * 1.5);
        let secWinPos = new THREE.Vector3(cx, elev + 0.1 + height + 1.5, z).addScaledVector(dir, houseDepth * 0.9 / 2 + 0.07).addScaledVector(right, secWindowOffset);
        dummy.position.copy(secWinPos);
        dummy.scale.set(2.0, 1.4, 1);
        dummy.rotation.set(0, rotationY, 0);
        dummy.updateMatrix();
        houseData.windows.push({ matrix: dummy.matrix.clone() });
        
        totalH += secondHeight;

        // Fierros
        for(let v = 0; v < 4; v++) {
            const fx = (v%2===0 ? 1 : -1) * (width * 0.4);
            const fz = (v<2 ? 1 : -1) * (houseDepth * 0.4);
            
            let ironPos = new THREE.Vector3(cx, elev + 0.1 + height + secondHeight + 1, z).addScaledVector(right, fx).addScaledVector(dir, fz);
            dummy.position.copy(ironPos);
            dummy.scale.set(1, 1, 1);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            houseData.irons.push({ matrix: dummy.matrix.clone() });
        }
    }

    // Techos y tanques
    if (seededRandom() > 0.5) {
        dummy.position.set(cx, elev + 0.1 + totalH + 0.1, z);
        dummy.scale.set(width * 1.05, 0.2, houseDepth * 1.05);
        dummy.rotation.set(0.05, rotationY, 0);
        dummy.updateMatrix();
        houseData.roofs.push({ matrix: dummy.matrix.clone() });
        
        if (seededRandom() > 0.5) {
            dummy.position.set(cx + (seededRandom()-0.5)*2, elev + 0.1 + totalH + 0.8, z + (seededRandom()-0.5)*2);
            dummy.scale.set(1, 1, 1);
            dummy.rotation.set(0,0,0);
            dummy.updateMatrix();
            houseData.tanks.push({ matrix: dummy.matrix.clone() });
        }
    } else {
        if (seededRandom() > 0.5) {
            dummy.position.set(cx, elev + 0.1 + totalH + 0.6, z);
            dummy.scale.set(1, 1, 1);
            dummy.rotation.set(0,0,0);
            dummy.updateMatrix();
            houseData.tanks.push({ matrix: dummy.matrix.clone() });
        }
    }
}

// Algoritmo de Anillo Perimetral para garantizar que toda casa mire a la calle
function buildHousesBlock(houseData, block, res) {
    const houseDepth = 10;
    
    // Limites de las casas (restando 1 de vereda)
    const minX = block.x1 + 1;
    const maxX = block.x2 - 1;
    const minZ = block.z1 + 1;
    const maxZ = block.z2 - 1;

    if (maxX - minX < 5 || maxZ - minZ < 5) return; // Muy chiquito

    // 1. CALLE NORTE (Mirando a -Z)
    let currentX = minX;
    while (currentX < maxX) {
        let width = 5 + seededRandom() * 4;
        if (currentX + width > maxX) width = maxX - currentX;
        if (width < 3) break;
        addHouse(houseData, res, currentX + width/2, minZ + houseDepth/2, width, houseDepth, -Math.PI);
        currentX += width;
    }

    // 2. CALLE SUR (Mirando a +Z)
    currentX = minX;
    while (currentX < maxX) {
        let width = 5 + seededRandom() * 4;
        if (currentX + width > maxX) width = maxX - currentX;
        if (width < 3) break;
        if (maxZ - houseDepth/2 < minZ + houseDepth) break; // Evitar colisión con norte
        addHouse(houseData, res, currentX + width/2, maxZ - houseDepth/2, width, houseDepth, 0);
        currentX += width;
    }

    // 3. CALLE OESTE (Mirando a -X)
    let currentZ = minZ + houseDepth + 1;
    let maxZLimit = maxZ - houseDepth - 1;
    while (currentZ < maxZLimit) {
        let width = 5 + seededRandom() * 4;
        if (currentZ + width > maxZLimit) width = maxZLimit - currentZ;
        if (width < 3) break;
        if (minX + houseDepth/2 > maxX - houseDepth/2) break; // Evitar colisión
        addHouse(houseData, res, minX + houseDepth/2, currentZ + width/2, width, houseDepth, -Math.PI/2);
        currentZ += width;
    }

    // 4. CALLE ESTE (Mirando a +X)
    currentZ = minZ + houseDepth + 1;
    while (currentZ < maxZLimit) {
        let width = 5 + seededRandom() * 4;
        if (currentZ + width > maxZLimit) width = maxZLimit - currentZ;
        if (width < 3) break;
        if (maxX - houseDepth/2 < minX + houseDepth/2) break; // Evitar colisión
        addHouse(houseData, res, maxX - houseDepth/2, currentZ + width/2, width, houseDepth, Math.PI/2);
        currentZ += width;
    }
}

// Inyecta las mallas optimizadas en la tarjeta gráfica
function flushInstancedHouses(scene, res, houseData) {
    // 1. Bases Pintadas
    if (houseData.paintedBases.length > 0) {
        const paintedIM = new THREE.InstancedMesh(res.boxGeo, res.instancedHouseMat, houseData.paintedBases.length);
        paintedIM.castShadow = true; paintedIM.receiveShadow = true;
        houseData.paintedBases.forEach((data, i) => {
            paintedIM.setMatrixAt(i, data.matrix);
            paintedIM.setColorAt(i, res.houseColors[data.colorIndex]);
        });
        scene.add(paintedIM);
    }

    // 2. Bases de Ladrillo
    if (houseData.brickBases.length > 0) {
        const brickIM = new THREE.InstancedMesh(res.boxGeo, res.brickMat, houseData.brickBases.length);
        brickIM.castShadow = true; brickIM.receiveShadow = true;
        houseData.brickBases.forEach((data, i) => { brickIM.setMatrixAt(i, data.matrix); });
        scene.add(brickIM);
    }
    
    // 3. Fachadas Pintadas (Híbridas)
    if (houseData.fronts.length > 0) {
        const frontIM = new THREE.InstancedMesh(res.frontGeo, res.instancedHouseMat, houseData.fronts.length);
        frontIM.receiveShadow = true;
        houseData.fronts.forEach((data, i) => {
            frontIM.setMatrixAt(i, data.matrix);
            frontIM.setColorAt(i, res.houseColors[data.colorIndex]);
        });
        scene.add(frontIM);
    }

    // 4. Segundos Pisos Pintados
    if (houseData.seconds.length > 0) {
        const secondIM = new THREE.InstancedMesh(res.boxGeo, res.instancedHouseMat, houseData.seconds.length);
        secondIM.castShadow = true; secondIM.receiveShadow = true;
        houseData.seconds.forEach((data, i) => {
            secondIM.setMatrixAt(i, data.matrix);
            secondIM.setColorAt(i, res.houseColors[data.colorIndex]);
        });
        scene.add(secondIM);
    }
    
    // 5. Segundos Pisos Ladrillo
    if (houseData.brickSeconds.length > 0) {
        const brickSecIM = new THREE.InstancedMesh(res.boxGeo, res.brickMat, houseData.brickSeconds.length);
        brickSecIM.castShadow = true; brickSecIM.receiveShadow = true;
        houseData.brickSeconds.forEach((data, i) => { brickSecIM.setMatrixAt(i, data.matrix); });
        scene.add(brickSecIM);
    }

    if (houseData.roofs.length > 0) {
        const roofIM = new THREE.InstancedMesh(res.boxGeo, res.roofMat, houseData.roofs.length);
        roofIM.castShadow = true;
        houseData.roofs.forEach((data, i) => { roofIM.setMatrixAt(i, data.matrix); });
        scene.add(roofIM);
    }

    if (houseData.irons.length > 0) {
        const ironIM = new THREE.InstancedMesh(res.ironGeo, res.ironMat, houseData.irons.length);
        houseData.irons.forEach((data, i) => { ironIM.setMatrixAt(i, data.matrix); });
        scene.add(ironIM);
    }
    
    if (houseData.tanks.length > 0) {
        const tankIM = new THREE.InstancedMesh(res.tankGeo, res.tankMat, houseData.tanks.length);
        tankIM.castShadow = true;
        houseData.tanks.forEach((data, i) => { tankIM.setMatrixAt(i, data.matrix); });
        scene.add(tankIM);
    }
    
    // 6. Puertas
    if (houseData.doors.length > 0) {
        const doorIM = new THREE.InstancedMesh(res.doorGeo, res.doorMat, houseData.doors.length);
        houseData.doors.forEach((data, i) => { doorIM.setMatrixAt(i, data.matrix); });
        scene.add(doorIM);
    }

    // 7. Ventanas
    if (houseData.windows.length > 0) {
        const winIM = new THREE.InstancedMesh(res.doorGeo, res.windowMat, houseData.windows.length);
        houseData.windows.forEach((data, i) => { winIM.setMatrixAt(i, data.matrix); });
        scene.add(winIM);
    }
    // 8. Cimientos (Pircas)
    if (houseData.foundations.length > 0) {
        const foundIM = new THREE.InstancedMesh(res.boxGeo, res.pircaMat, houseData.foundations.length);
        foundIM.castShadow = true; foundIM.receiveShadow = true;
        houseData.foundations.forEach((data, i) => { foundIM.setMatrixAt(i, data.matrix); });
        scene.add(foundIM);
    }
}

function buildPark(scene, block, res) {
    const elev = getTerrainHeight(block.cx, block.cz);
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(block.w - 2, block.h - 2), res.grassMat);
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(block.cx, elev + 0.1, block.cz);
    grass.receiveShadow = true;
    scene.add(grass);

    // Árboles en el área irregular del parque
    const area = block.w * block.h;
    const numTrees = Math.floor(area / 150); // Densidad según el tamaño
    const treeGeo = new THREE.IcosahedronGeometry(1.5, 1);
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.4, 3);

    for (let k = 0; k < numTrees; k++) {
        const tx = block.x1 + 2 + seededRandom() * (block.w - 4);
        const tz = block.z1 + 2 + seededRandom() * (block.h - 4);
        
        const trunk = new THREE.Mesh(trunkGeo, res.treeTrunkMat);
        trunk.position.set(tx, elev + 1.5, tz);
        trunk.castShadow = true;
        scene.add(trunk);

        const leaves = new THREE.Mesh(treeGeo, res.treeLeafMat);
        leaves.position.set(tx, elev + 3 + seededRandom(), tz);
        leaves.scale.setScalar(1 + seededRandom() * 0.5);
        leaves.castShadow = true;
        scene.add(leaves);
    }
}

function buildCanchita(scene, block, res) {
    const elev = getTerrainHeight(block.cx, block.cz);
    const isRotated = block.w > block.h;
    const courtWidth = isRotated ? 40 : 20;
    const courtLength = isRotated ? 20 : 40;

    const court = new THREE.Mesh(new THREE.PlaneGeometry(courtWidth, courtLength), res.courtMat);
    court.rotation.x = -Math.PI / 2;
    court.position.set(block.cx, elev + 0.1, block.cz);
    court.receiveShadow = true;
    scene.add(court);

    // Línea central
    const centerLine = new THREE.Mesh(new THREE.PlaneGeometry(isRotated ? 0.5 : courtWidth, isRotated ? courtLength : 0.5), res.whiteMat);
    centerLine.rotation.x = -Math.PI / 2;
    centerLine.position.set(block.cx, elev + 0.11, block.cz);
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
            p1.position.set(xOffset, elev + 1.25, block.cz - 3);
            p2.position.set(xOffset, elev + 1.25, block.cz + 3);
            cross.rotation.x = Math.PI / 2;
            cross.position.set(xOffset, elev + 2.5, block.cz);
        } else {
            const zOffset = block.cz + side * (courtLength / 2);
            p1.position.set(block.cx - 3, elev + 1.25, zOffset);
            p2.position.set(block.cx + 3, elev + 1.25, zOffset);
            cross.rotation.z = Math.PI / 2;
            cross.position.set(block.cx, elev + 2.5, zOffset);
        }

        p1.castShadow = true; p2.castShadow = true; cross.castShadow = true;
        scene.add(p1); scene.add(p2); scene.add(cross);
    });
}

function buildPlaza(scene, block, res) {
    const elev = getTerrainHeight(block.cx, block.cz);
    // Piso de la plaza principal
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(block.w - 2, block.h - 2), res.concreteMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(block.cx, elev + 0.1, block.cz);
    floor.receiveShadow = true;
    scene.add(floor);

    // Monumento central (Obelisco)
    const baseGeo = new THREE.BoxGeometry(5, 1, 5);
    const obeliskGeo = new THREE.BoxGeometry(1.5, 12, 1.5);
    const monMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.5 });

    const base = new THREE.Mesh(baseGeo, monMat);
    base.position.set(block.cx, elev + 0.6, block.cz);
    base.castShadow = true;
    base.receiveShadow = true;
    scene.add(base);

    const obelisk = new THREE.Mesh(obeliskGeo, monMat);
    obelisk.position.set(block.cx, elev + 6.5, block.cz);
    obelisk.castShadow = true;
    obelisk.receiveShadow = true;
    scene.add(obelisk);

    // Arboles y jardineras en las esquinas
    const treeGeo = new THREE.IcosahedronGeometry(2, 1);
    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 4);
    
    const corners = [
        {x: block.cx - block.w/2 + 6, z: block.cz - block.h/2 + 6},
        {x: block.cx + block.w/2 - 6, z: block.cz - block.h/2 + 6},
        {x: block.cx - block.w/2 + 6, z: block.cz + block.h/2 - 6},
        {x: block.cx + block.w/2 - 6, z: block.cz + block.h/2 - 6},
    ];

    corners.forEach(c => {
        const jard = new THREE.Mesh(new THREE.BoxGeometry(6, 0.5, 6), res.brickMat);
        jard.position.set(c.x, elev + 0.35, c.z);
        jard.castShadow = true;
        scene.add(jard);

        const trunk = new THREE.Mesh(trunkGeo, res.treeTrunkMat);
        trunk.position.set(c.x, elev + 2.5, c.z);
        trunk.castShadow = true;
        scene.add(trunk);

        const leaves = new THREE.Mesh(treeGeo, res.treeLeafMat);
        leaves.position.set(c.x, elev + 5, c.z);
        leaves.castShadow = true;
        scene.add(leaves);
        
        // Colisiones de las jardineras
        houseColliders.push({
            minX: c.x - 3, maxX: c.x + 3,
            minZ: c.z - 3, maxZ: c.z + 3
        });
    });

    // Colisión del obelisco central
    houseColliders.push({
        minX: block.cx - 2.5, maxX: block.cx + 2.5,
        minZ: block.cz - 2.5, maxZ: block.cz + 2.5
    });
}

function createBrickTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Fondo grisáceo (cemento)
    ctx.fillStyle = '#9c9284';
    ctx.fillRect(0, 0, 512, 512);
    
    const rows = 16;
    const cols = 6;
    const brickW = 512 / cols;
    const brickH = 512 / rows;
    const gap = 3;
    
    for (let r = 0; r < rows; r++) {
        const offset = (r % 2 === 0) ? 0 : brickW / 2;
        for (let c = -1; c <= cols; c++) {
            let x = c * brickW + offset;
            let y = r * brickH;
            
            // Color pandereta (naranja ladrillo con variaciones)
            const hue = 12 + seededRandom() * 5;
            const sat = 50 + seededRandom() * 20;
            const lit = 45 + seededRandom() * 15;
            ctx.fillStyle = `hsl(${hue}, ${sat}%, ${lit}%)`;
            
            ctx.fillRect(x + gap, y + gap, brickW - gap*2, brickH - gap*2);
        }
    }
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3); // Para que los ladrillos se vean de tamaño realista
    return tex;
}

function createDoorTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    // Puerta enrollable (metálica)
    ctx.fillStyle = '#4a5054';
    ctx.fillRect(0, 0, 128, 256);
    
    ctx.fillStyle = '#2c3033';
    for(let y = 0; y < 256; y += 12) {
        ctx.fillRect(0, y, 128, 3); // Relieve del metal
    }
    
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
}

function createWindowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#1c2833'; // Vidrio oscuro
    ctx.fillRect(0, 0, 256, 256);
    
    ctx.fillStyle = '#a0a0a0'; // Marco de aluminio
    const border = 12;
    ctx.fillRect(0, 0, 256, border); // Top
    ctx.fillRect(0, 256 - border, 256, border); // Bot
    ctx.fillRect(0, 0, border, 256); // Left
    ctx.fillRect(256 - border, 0, border, 256); // Right
    
    ctx.fillRect(128 - border/2, 0, border, 256); // Centro vertical
    ctx.fillRect(0, 128 - border/2, 256, border); // Centro horizontal
    
    // Reflejo falso
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(150, 0);
    ctx.lineTo(0, 150);
    ctx.fill();
    
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
}

function createSidewalkTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Fondo concreto oscuro
    ctx.fillStyle = '#6a7075';
    ctx.fillRect(0, 0, 512, 512);
    
    // Textura granulada (ruido muy notorio)
    for(let i=0; i<8000; i++) {
        ctx.fillStyle = seededRandom() > 0.5 ? '#4e5358' : '#8a9095';
        ctx.fillRect(seededRandom()*512, seededRandom()*512, 3, 3);
    }
    
    // Cuadrícula (paños de vereda típica) con líneas oscuras
    ctx.strokeStyle = '#2c3135';
    ctx.lineWidth = 6;
    ctx.beginPath();
    // Líneas horizontales y verticales cada 128px
    for(let i = 0; i <= 512; i += 128) {
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 512);
        ctx.moveTo(0, i);
        ctx.lineTo(512, i);
    }
    ctx.stroke();
    
    // Borde de la vereda oscuro
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, 0, 512, 512);
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    // Forzar actualización (aunque CanvasTexture suele hacerlo)
    tex.needsUpdate = true;
    return tex;
}
