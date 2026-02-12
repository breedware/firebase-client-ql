// utils/getSystemInfo.ts
export async function getSystemInfo() {
  if (typeof window === 'undefined') {
    throw new Error('Must be called on client side');
  }

  const navigatorInfo = window.navigator;
  // 📍 Location (GPS)
  const getGeoLocation = (): Promise<{
    latitude: number | null;
    longitude: number | null;
    accuracy?: number;
    source: 'gps' | 'denied';
  }> =>
    new Promise((resolve) => {
      if (!navigator.geolocation) {
        return resolve({
          latitude: null,
          longitude: null,
          source: 'denied',
        });
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            source: 'gps',
          });
        },
        () => {
          resolve({
            latitude: null,
            longitude: null,
            source: 'denied',
          });
        },
        { timeout: 5000 }
      );
    });

  // 🔋 Battery (optional)
  const getBatteryInfo = async () => {
    
    try {
      // @ts-ignore
      if (navigator.getBattery) {
        // @ts-ignore
        const battery = await navigator.getBattery();
        return {
          level: battery.level,
          charging: battery.charging,
        };
      }
    } catch {}
    return null;
  };

  return {
    device: {
      userAgent: navigatorInfo.userAgent,
      platform: navigatorInfo.platform,
      vendor: navigatorInfo.vendor,
      hardwareConcurrency: navigatorInfo.hardwareConcurrency,
      deviceMemory: (navigatorInfo as any).deviceMemory ?? null,
    },

    browser: {
      language: navigatorInfo.language,
      languages: navigatorInfo.languages,
      cookiesEnabled: navigatorInfo.cookieEnabled,
      online: navigatorInfo.onLine,
    },

    screen: {
      width: window.screen.width,
      height: window.screen.height,
      colorDepth: window.screen.colorDepth,
      pixelRatio: window.devicePixelRatio,
    },

    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,

    network: (navigatorInfo as any).connection
      ? {
          effectiveType: (navigatorInfo as any).connection.effectiveType,
          downlink: (navigatorInfo as any).connection.downlink,
          rtt: (navigatorInfo as any).connection.rtt,
        }
      : null,

    battery: await getBatteryInfo(),

    location: await getGeoLocation(),

    timestamp: Date.now(),
  };
}
