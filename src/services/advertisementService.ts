import type { ApiResponse } from '../types/api'
import type {
  AdvertisementDetailDto,
  AdvertisementGridRequestDto,
  AdvertisementListDto,
  AdvertisementMediaType,
  AdvertisementUploadedAsset,
  AdvertisementUploadSignatureRequestDto,
  AdvertisementUploadSignatureResponseDto,
  AdvertisementUpsertDto,
} from '../types/advertisement'
import { reportExternalFetchError } from '../utils/centerLogClient'
import request, { unwrapApiData } from '../utils/request'

const API_BASE = '/api/react/v1/advertisements'

function pick<T = unknown>(source: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const key of keys) {
    const value = source[key]
    if (value !== undefined && value !== null) {
      return value as T
    }
  }
  return undefined
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function asStringRecord(value: unknown): Record<string, string> {
  const record = asRecord(value)
  return Object.entries(record).reduce<Record<string, string>>((result, [key, item]) => {
    if (item === undefined || item === null) {
      return result
    }
    result[key] = String(item)
    return result
  }, {})
}

function asString(value: unknown, fallback = '') {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
}

function asNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

function asBoolean(value: unknown) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') return ['true', '1', 'yes'].includes(value.trim().toLowerCase())
  return false
}

function normalizeMediaType(value: unknown): AdvertisementMediaType {
  return String(value).toLowerCase() === 'video' ? 'video' : 'image'
}

function normalizeAdvertisement(raw: unknown): AdvertisementListDto {
  const item = asRecord(raw)
  const storesRaw = pick<unknown[]>(item, 'stores', 'Stores') ?? []
  return {
    id: asString(pick(item, 'id', 'Id', 'advertisementId', 'AdvertisementId')),
    title: asString(pick(item, 'title', 'Title')),
    description: asString(pick(item, 'description', 'Description')),
    mediaType: normalizeMediaType(pick(item, 'mediaType', 'MediaType')),
    mediaUrl: asString(pick(item, 'mediaUrl', 'MediaUrl')),
    thumbnailUrl: asString(pick(item, 'thumbnailUrl', 'ThumbnailUrl')),
    objectKey: asString(pick(item, 'objectKey', 'ObjectKey')),
    originalFileName: asString(pick(item, 'originalFileName', 'OriginalFileName')),
    contentType: asString(pick(item, 'contentType', 'ContentType')),
    fileSize: asNumber(pick(item, 'fileSize', 'FileSize')),
    effectiveStart: asString(pick(item, 'effectiveStart', 'EffectiveStart')),
    effectiveEnd: asString(pick(item, 'effectiveEnd', 'EffectiveEnd')),
    isEnabled: asBoolean(pick(item, 'isEnabled', 'IsEnabled')),
    sortOrder: asNumber(pick(item, 'sortOrder', 'SortOrder')),
    createdAt: asString(pick(item, 'createdAt', 'CreatedAt')),
    createdBy: asString(pick(item, 'createdBy', 'CreatedBy')),
    updatedAt: asString(pick(item, 'updatedAt', 'UpdatedAt')),
    updatedBy: asString(pick(item, 'updatedBy', 'UpdatedBy')),
    stores: storesRaw.map((store) => {
      const storeRecord = asRecord(store)
      return { storeCode: asString(pick(storeRecord, 'storeCode', 'StoreCode')) }
    }).filter((store) => store.storeCode),
  }
}

function normalizeDetail(payload: unknown): AdvertisementDetailDto {
  const data = unwrapApiData(payload as ApiResponse<unknown>)
  return normalizeAdvertisement(data)
}

function normalizeGridResult(payload: unknown): { items: AdvertisementListDto[]; total: number } {
  const data = asRecord(unwrapApiData(payload as ApiResponse<unknown>))
  const items = pick<unknown[]>(data, 'items', 'Items') ?? []
  return {
    items: items.map(normalizeAdvertisement),
    total: asNumber(pick(data, 'total', 'Total', 'totalCount', 'TotalCount')),
  }
}

function normalizeUploadSignature(payload: unknown): AdvertisementUploadSignatureResponseDto {
  const data = asRecord(unwrapApiData(payload as ApiResponse<unknown>))
  return {
    objectKey: asString(pick(data, 'objectKey', 'ObjectKey')),
    url: asString(pick(data, 'url', 'Url', 'uploadUrl', 'UploadUrl')),
    uploadUrl: asString(pick(data, 'uploadUrl', 'UploadUrl')),
    mediaUrl: asString(pick(data, 'mediaUrl', 'MediaUrl')),
    headers: asStringRecord(pick(data, 'headers', 'Headers')),
  }
}

export async function getAdvertisementGrid(data: AdvertisementGridRequestDto) {
  const response = await request.post<
    ApiResponse<{ items: AdvertisementListDto[]; total: number }> | { items: AdvertisementListDto[]; total: number }
  >(
    `${API_BASE}/grid`,
    data,
  )
  return normalizeGridResult(response)
}

export async function getAdvertisementById(id: string): Promise<AdvertisementDetailDto> {
  const response = await request.get<ApiResponse<AdvertisementDetailDto>>(`${API_BASE}/${encodeURIComponent(id)}`)
  return normalizeDetail(response)
}

export async function createAdvertisement(data: AdvertisementUpsertDto): Promise<AdvertisementDetailDto> {
  const response = await request.post<ApiResponse<AdvertisementDetailDto>>(API_BASE, data)
  return normalizeDetail(response)
}

export async function updateAdvertisement(id: string, data: AdvertisementUpsertDto): Promise<AdvertisementDetailDto> {
  const response = await request.put<ApiResponse<AdvertisementDetailDto>>(`${API_BASE}/${encodeURIComponent(id)}`, data)
  return normalizeDetail(response)
}

export async function deleteAdvertisement(id: string): Promise<void> {
  await request.delete(`${API_BASE}/${encodeURIComponent(id)}`)
}

export async function enableAdvertisement(id: string, enable: boolean): Promise<void> {
  await request.post(`${API_BASE}/${encodeURIComponent(id)}/enable`, undefined, { params: { enable } })
}

export async function createAdvertisementUploadSignature(
  data: AdvertisementUploadSignatureRequestDto,
): Promise<AdvertisementUploadSignatureResponseDto> {
  const response = await request.post<ApiResponse<AdvertisementUploadSignatureResponseDto>>(`${API_BASE}/upload-signature`, data)
  return normalizeUploadSignature(response)
}

export async function uploadAdvertisementAsset(file: File): Promise<AdvertisementUploadedAsset> {
  const signature = await createAdvertisementUploadSignature({
    fileName: file.name,
    contentType: file.type || 'application/octet-stream',
    fileSize: file.size,
  })
  const uploadUrl = signature.uploadUrl || signature.url

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: signature.headers,
    body: file,
  }).catch((error) => {
    reportExternalFetchError({
      url: uploadUrl,
      method: 'PUT',
      error,
    })
    throw error
  })
  if (!response.ok) {
    const uploadError = new Error(`Upload failed: ${response.status}`)
    // 上传失败日志必须旁路发送，不能等待、更不能影响原始上传报错。
    reportExternalFetchError({
      url: uploadUrl,
      method: 'PUT',
      statusCode: response.status,
      error: uploadError,
      responsePayload: {
        message: response.statusText || `HTTP ${response.status}`,
      },
    })
    throw uploadError
  }

  return {
    objectKey: signature.objectKey,
    mediaUrl: signature.mediaUrl,
    originalFileName: file.name,
    contentType: file.type || 'application/octet-stream',
    fileSize: file.size,
  }
}
