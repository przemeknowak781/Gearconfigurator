// A simple, dependency-free function to export geometry to a GLB file.

interface Geometry {
    vertices: number[];
    normals: number[];
    indices: number[];
}

export const exportGLB = ({ vertices, normals, indices }: Geometry): Blob => {
    const positions = new Float32Array(vertices);
    const normalData = new Float32Array(normals);
    const indexData = new Uint16Array(indices);

    const vertexCount = positions.length / 3;

    // Find min/max for positions, which is required by glTF
    const minPos = [Infinity, Infinity, Infinity];
    const maxPos = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < vertexCount; i++) {
        for (let j = 0; j < 3; j++) {
            const v = positions[i * 3 + j];
            minPos[j] = Math.min(minPos[j], v);
            maxPos[j] = Math.max(maxPos[j], v);
        }
    }

    // --- Create the binary buffer ---
    const positionsByteOffset = 0;
    const normalsByteOffset = positions.byteLength;
    const indicesByteOffset = normalsByteOffset + normalData.byteLength;
    const binaryBufferLength = indicesByteOffset + indexData.byteLength;

    const binaryBuffer = new ArrayBuffer(binaryBufferLength);
    const dataView = new DataView(binaryBuffer);

    // Copy data into the buffer
    let byteOffset = 0;
    for (let i = 0; i < positions.length; i++) {
        dataView.setFloat32(byteOffset, positions[i], true);
        byteOffset += 4;
    }
    for (let i = 0; i < normalData.length; i++) {
        dataView.setFloat32(byteOffset, normalData[i], true);
        byteOffset += 4;
    }
    for (let i = 0; i < indexData.length; i++) {
        dataView.setUint16(byteOffset, indexData[i], true);
        byteOffset += 2;
    }

    // --- Create the JSON chunk ---
    const json = {
        asset: { version: '2.0' },
        scenes: [{ nodes: [0] }],
        nodes: [{ mesh: 0 }],
        meshes: [{
            primitives: [{
                attributes: {
                    POSITION: 1, // accessor index
                    NORMAL: 2,   // accessor index
                },
                indices: 0, // accessor index
            }],
        }],
        buffers: [{ byteLength: binaryBufferLength }],
        bufferViews: [
            { buffer: 0, byteOffset: indicesByteOffset, byteLength: indexData.byteLength, target: 34963 }, // ELEMENT_ARRAY_BUFFER
            { buffer: 0, byteOffset: positionsByteOffset, byteLength: positions.byteLength, target: 34962 }, // ARRAY_BUFFER
            { buffer: 0, byteOffset: normalsByteOffset, byteLength: normalData.byteLength, target: 34962 }, // ARRAY_BUFFER
        ],
        accessors: [
            { bufferView: 0, componentType: 5123, count: indexData.length, type: 'SCALAR' }, // UNSIGNED_SHORT
            { bufferView: 1, componentType: 5126, count: vertexCount, type: 'VEC3', min: minPos, max: maxPos }, // FLOAT
            { bufferView: 2, componentType: 5126, count: vertexCount, type: 'VEC3' }, // FLOAT
        ],
    };

    const jsonString = JSON.stringify(json);
    const jsonByteLength = new TextEncoder().encode(jsonString).length;

    // --- Create the final GLB file ---
    // GLB format: Header | JSON chunk | Binary chunk
    const headerByteLength = 12;
    const jsonChunkLength = Math.ceil(jsonByteLength / 4) * 4; // Must be 4-byte aligned
    const binaryChunkLength = binaryBufferLength;
    const totalByteLength = headerByteLength + 8 + jsonChunkLength + 8 + binaryChunkLength;

    const glbBuffer = new ArrayBuffer(totalByteLength);
    const glbView = new DataView(glbBuffer);
    const textEncoder = new TextEncoder();

    // Header
    glbView.setUint32(0, 0x46546C67, true); // "glTF"
    glbView.setUint32(4, 2, true); // version 2
    glbView.setUint32(8, totalByteLength, true);

    let offset = headerByteLength;

    // JSON Chunk
    glbView.setUint32(offset, jsonChunkLength, true);
    offset += 4;
    glbView.setUint32(offset, 0x4E4F534A, true); // "JSON"
    offset += 4;
    const jsonBytes = textEncoder.encode(jsonString);
    const glbBytes = new Uint8Array(glbBuffer);
    glbBytes.set(jsonBytes, offset);
    // Pad with spaces
    for (let i = jsonByteLength; i < jsonChunkLength; i++) {
        glbBytes[offset + i] = 0x20; // space
    }
    offset += jsonChunkLength;

    // Binary Chunk
    glbView.setUint32(offset, binaryChunkLength, true);
    offset += 4;
    glbView.setUint32(offset, 0x004E4942, true); // "BIN"
    offset += 4;
    glbBytes.set(new Uint8Array(binaryBuffer), offset);

    return new Blob([glbBuffer], { type: 'model/gltf-binary' });
};
