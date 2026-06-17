import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { lookupBarcode } from '../api/barcode';
import { FoodDetailSource } from '../api/usda';
import { colors, fontSize, radius, spacing } from '../theme';
import { FoodDetailSheet } from './FoodDetailSheet';

const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;

/**
 * Live barcode scanner. Scans a product UPC/EAN, looks it up (Open Food Facts,
 * USDA fallback), and shows the result in the detail sheet to review and log
 * against `day`. Not found → prompt to try again.
 */
export function BarcodeScannerModal({
  visible,
  day,
  onClose,
  onLogged,
}: {
  visible: boolean;
  day: string;
  onClose: () => void;
  onLogged?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false); // prevents repeat scans
  const [looking, setLooking] = useState(false);
  const [detail, setDetail] = useState<FoodDetailSource | null>(null);

  useEffect(() => {
    if (visible) {
      setLocked(false);
      setLooking(false);
      setDetail(null);
    }
  }, [visible]);

  const handleScan = async ({ data }: { data: string }) => {
    if (locked) return;
    setLocked(true);
    setLooking(true);
    try {
      const result = await lookupBarcode(data);
      if (result) {
        setDetail(result);
      } else {
        Alert.alert('Not found', `No product matched ${data}.`, [
          { text: 'Try again', onPress: () => setLocked(false) },
          { text: 'Close', style: 'cancel', onPress: onClose },
        ]);
      }
    } catch {
      Alert.alert('Lookup failed', 'Please try again.', [
        { text: 'OK', onPress: () => setLocked(false) },
      ]);
    } finally {
      setLooking(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        {!permission ? null : !permission.granted ? (
          <View style={[styles.center, { paddingTop: insets.top }]}>
            <Ionicons name="camera-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.permText}>Camera access is needed to scan barcodes.</Text>
            <Pressable style={styles.permButton} onPress={requestPermission}>
              <Text style={styles.permButtonText}>Grant access</Text>
            </Pressable>
          </View>
        ) : (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
            onBarcodeScanned={locked ? undefined : handleScan}
          />
        )}

        {/* Overlay: aiming frame + instructions */}
        {permission?.granted && !detail && (
          <View style={styles.overlay} pointerEvents="box-none">
            <View style={styles.frame} />
            <Text style={styles.hint}>
              {looking ? 'Looking up product…' : 'Point at a barcode'}
            </Text>
            {looking && <ActivityIndicator color={colors.textPrimary} style={styles.spinner} />}
          </View>
        )}

        <Pressable style={[styles.cancel, { top: insets.top + spacing.md }]} onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={26} color={colors.textPrimary} />
        </Pressable>
      </View>

      {detail && (
        <FoodDetailSheet
          detail={detail}
          day={day}
          onClose={() => {
            setDetail(null);
            setLocked(false); // resume scanning
          }}
          onLogged={() => {
            onLogged?.();
            onClose();
          }}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xxl,
  },
  permText: {
    color: colors.textSecondary,
    fontSize: fontSize.body,
    fontWeight: '600',
    textAlign: 'center',
  },
  permButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  permButtonText: {
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  frame: {
    width: '70%',
    height: 160,
    borderWidth: 3,
    borderColor: colors.textPrimary,
    borderRadius: radius.lg,
    backgroundColor: 'transparent',
  },
  hint: {
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  spinner: {
    marginTop: spacing.sm,
  },
  cancel: {
    position: 'absolute',
    right: spacing.xl,
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
