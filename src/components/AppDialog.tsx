import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';

type Tone = 'default' | 'success' | 'error' | 'warning';

interface AppDialogAction {
  label: string;
  onPress: () => void;
  mode?: 'text' | 'outlined' | 'contained';
}

interface AppDialogProps {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  message: string;
  tone?: Tone;
  icon?: keyof typeof Ionicons.glyphMap;
  primaryAction: AppDialogAction;
  secondaryAction?: AppDialogAction;
}

const toneMap: Record<Tone, { color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  default: { color: theme.colors.primary, icon: 'information-circle' },
  success: { color: theme.colors.success, icon: 'checkmark-circle' },
  error: { color: theme.colors.error, icon: 'alert-circle' },
  warning: { color: theme.colors.warning, icon: 'warning' },
};

export function AppDialog({
  visible,
  onDismiss,
  title,
  message,
  tone = 'default',
  icon,
  primaryAction,
  secondaryAction,
}: AppDialogProps) {
  const resolvedTone = toneMap[tone];
  const resolvedIcon = icon ?? resolvedTone.icon;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <View style={styles.dialog}>
          <View style={styles.content}>
            <View style={[styles.iconWrap, { backgroundColor: `${resolvedTone.color}18` }]}>
              <Ionicons name={resolvedIcon} size={28} color={resolvedTone.color} />
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
          </View>
          <View style={[styles.actions, secondaryAction ? styles.actionsRow : styles.actionsSingle]}>
            {secondaryAction ? (
              <TouchableOpacity
                onPress={secondaryAction.onPress}
                activeOpacity={0.85}
                style={[
                  styles.actionButton,
                  styles.actionButtonHalf,
                  styles.secondaryButton,
                  secondaryAction.mode === 'text' ? styles.textButton : null,
                ]}
              >
                <Text style={[styles.actionLabel, styles.secondaryButtonLabel]}>
                  {secondaryAction.label}
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={primaryAction.onPress}
              activeOpacity={0.85}
              style={[
                styles.actionButton,
                secondaryAction ? styles.actionButtonHalf : styles.actionButtonFull,
                primaryAction.mode === 'outlined' ? styles.outlinedPrimaryButton : null,
                primaryAction.mode === 'text' ? styles.textButton : { backgroundColor: resolvedTone.color },
              ]}
            >
              <Text
                style={[
                  styles.actionLabel,
                  primaryAction.mode === 'contained' || primaryAction.mode === undefined
                    ? styles.primaryButtonLabelFilled
                    : { color: resolvedTone.color },
                ]}
              >
                {primaryAction.label}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.56)',
  },
  dialog: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 420,
  },
  content: {
    alignItems: 'center',
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
    includeFontPadding: false,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    includeFontPadding: false,
  },
  actions: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    paddingTop: theme.spacing.xs,
  },
  actionsSingle: {
    alignItems: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    minHeight: 52,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  actionButtonFull: {
    width: '100%',
  },
  actionButtonHalf: {
    width: '48%',
  },
  secondaryButton: {
    backgroundColor: theme.colors.surfaceVariant,
    borderColor: theme.colors.border,
    borderWidth: 1,
  },
  outlinedPrimaryButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'transparent',
  },
  textButton: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    includeFontPadding: false,
  },
  secondaryButtonLabel: {
    color: theme.colors.text,
  },
  primaryButtonLabelFilled: {
    color: theme.colors.background,
  },
});
