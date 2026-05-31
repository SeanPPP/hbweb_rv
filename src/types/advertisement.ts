export type AdvertisementMediaType = 'image' | 'video'

export interface AdvertisementStoreItemDto {
  storeCode: string
}

export interface AdvertisementSortModelItemDto {
  ColId: string
  Sort: 'asc' | 'desc'
}

export interface AdvertisementListDto {
  id: string
  title: string
  description?: string
  mediaType: AdvertisementMediaType
  mediaUrl: string
  thumbnailUrl?: string
  objectKey: string
  originalFileName: string
  contentType: string
  fileSize: number
  effectiveStart: string
  effectiveEnd: string
  isEnabled: boolean
  sortOrder: number
  createdAt?: string
  createdBy?: string
  updatedAt?: string
  updatedBy?: string
  stores: AdvertisementStoreItemDto[]
}

export type AdvertisementDetailDto = AdvertisementListDto

export interface AdvertisementGridRequestDto {
  title?: string
  storeCode?: string
  mediaType?: string
  isEnabled?: boolean
  pageNumber?: number
  pageSize?: number
  startRow?: number
  endRow?: number
  globalSearch?: string
  sortModel?: AdvertisementSortModelItemDto[]
}

export interface AdvertisementUpsertDto {
  title: string
  description?: string
  mediaType: AdvertisementMediaType
  mediaUrl: string
  thumbnailUrl?: string
  objectKey: string
  originalFileName: string
  contentType: string
  fileSize: number
  effectiveStart: string
  effectiveEnd: string
  isEnabled: boolean
  sortOrder: number
  stores: AdvertisementStoreItemDto[]
}

export interface AdvertisementUploadSignatureRequestDto {
  fileName: string
  contentType: string
  fileSize: number
}

export interface AdvertisementUploadSignatureResponseDto {
  objectKey: string
  url: string
  uploadUrl?: string
  mediaUrl: string
  headers?: Record<string, string>
}

export interface AdvertisementUploadedAsset {
  objectKey: string
  mediaUrl: string
  originalFileName: string
  contentType: string
  fileSize: number
}
