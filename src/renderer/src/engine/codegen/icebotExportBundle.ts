import { strToU8, zipSync } from 'fflate'
import type { IceBotArtifactSidecar } from './icebotArtifactSidecar'

export interface IceBotExportArtifact {
  fileName: string
  lua: string
  sidecarFileName: string
  sidecar: IceBotArtifactSidecar
  runOrder: number
}

export interface IceBotExportManifest {
  schemaVersion: 1
  exportId: string
  exportedAt: string
  program: {
    code: string
    name: string
    runtimeTargetCode: 'FAIRINO_LUA_V1'
    machineModelCode: 'FR5'
    artifacts: Array<{
      artifactCode: string
      fileName: string
      sidecarFileName: string
      runOrder: number
    }>
  }
}

export function createIceBotExportBundle(projectName: string, artifacts: IceBotExportArtifact[]): Uint8Array {
  if (artifacts.length === 0) throw new Error('An IceBot export requires at least one artifact.')
  const ordered = [...artifacts].sort((left, right) => left.runOrder - right.runOrder)
  ordered.forEach((artifact, index) => {
    if (artifact.runOrder !== index + 1) throw new Error('Artifact run order must be contiguous from 1.')
  })

  const normalizedProjectName = projectName.trim() || 'Untitled Robot Program'
  const programCode = normalizedProjectName
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase() || 'UNTITLED_ROBOT_PROGRAM'
  const manifest: IceBotExportManifest = {
    schemaVersion: 1,
    exportId: crypto.randomUUID(),
    exportedAt: new Date().toISOString(),
    program: {
      code: programCode,
      name: normalizedProjectName,
      runtimeTargetCode: 'FAIRINO_LUA_V1',
      machineModelCode: 'FR5',
      artifacts: ordered.map((artifact) => ({
        artifactCode: artifact.sidecar.artifactCode,
        fileName: artifact.fileName,
        sidecarFileName: artifact.sidecarFileName,
        runOrder: artifact.runOrder
      }))
    }
  }

  const files: Record<string, Uint8Array> = {
    'export-manifest.json': strToU8(JSON.stringify(manifest, null, 2))
  }
  for (const artifact of ordered) {
    files[`artifacts/${artifact.fileName}`] = strToU8(artifact.lua)
    files[`contracts/${artifact.sidecarFileName}`] = strToU8(JSON.stringify(artifact.sidecar, null, 2))
  }
  return zipSync(files, { level: 6 })
}
