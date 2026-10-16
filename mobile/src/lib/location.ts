import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'

export type DeviceLocation = { latitude: number; longitude: number; accuracy: number }

export class LocationPermissionError extends Error {}

export async function getCurrentLocation(): Promise<DeviceLocation> {
  if (Capacitor.isNativePlatform()) {
    let permissions = await Geolocation.checkPermissions()
    if (permissions.location !== 'granted') permissions = await Geolocation.requestPermissions()
    if (permissions.location !== 'granted') {
      throw new LocationPermissionError('위치 권한이 꺼져 있어요. 권한을 허용하거나 동네를 직접 선택해 주세요.')
    }
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    })
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
    }
  }

  if (!navigator.geolocation) throw new Error('이 브라우저는 위치 기능을 지원하지 않습니다.')
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      position => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }),
      error => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new LocationPermissionError('위치 권한이 꺼져 있어요. 권한을 허용하거나 동네를 직접 선택해 주세요.'))
        } else if (error.code === error.TIMEOUT) {
          reject(new Error('위치 확인 시간이 초과됐어요. 다시 시도해 주세요.'))
        } else {
          reject(new Error('현재 위치를 확인하지 못했어요. 기기 위치 설정을 확인해 주세요.'))
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    )
  })
}
