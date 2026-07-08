import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { SeatView } from './Table9Max';

export interface RebuyApproval {
  requestId: string;
  userId: string;
  nickname: string;
  amount: number;
  deadline: number;
}

export interface DissolveVoteState {
  initiatedBy: string;
  deadline: number;
  requiredApprovals: number;
  currentApprovals: number;
  seatedCount: number;
}

interface PrivateTablePanelsProps {
  isPrivate: boolean;
  isHost: boolean;
  paused: boolean;
  buyInCap: number;
  myChips: number;
  humanSeats: SeatView[];
  rebuyApproval: RebuyApproval | null;
  dissolveVote: DissolveVoteState | null;
  onRequestRebuy: () => void;
  onApproveRebuy: () => void;
  onRejectRebuy: () => void;
  onDissolveApprove: () => void;
  onDissolveReject: () => void;
  onPause: () => void;
  onResume: () => void;
  onStartDissolve: () => void;
  onKick: (userId: string) => void;
  onReport: (userId: string) => void;
}

export function PrivateTablePanels({
  isPrivate,
  isHost,
  paused,
  buyInCap,
  myChips,
  humanSeats,
  rebuyApproval,
  dissolveVote,
  onRequestRebuy,
  onApproveRebuy,
  onRejectRebuy,
  onDissolveApprove,
  onDissolveReject,
  onPause,
  onResume,
  onStartDissolve,
  onKick,
  onReport,
}: PrivateTablePanelsProps) {
  const { t } = useTranslation();

  if (!isPrivate) return null;

  const secondsLeft = (deadline: number) => Math.max(0, Math.ceil((deadline - Date.now()) / 1000));

  return (
    <>
      {paused && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{t('table.paused')}</Text>
        </View>
      )}

      <View style={styles.toolbar}>
        {!isHost && myChips < buyInCap && (
          <Pressable style={styles.toolBtn} onPress={onRequestRebuy}>
            <Text style={styles.toolText}>{t('table.rebuy')}</Text>
          </Pressable>
        )}

        {isHost && (
          <>
            <Pressable style={styles.toolBtn} onPress={paused ? onResume : onPause}>
              <Text style={styles.toolText}>{paused ? t('table.resume') : t('table.pause')}</Text>
            </Pressable>
            <Pressable style={styles.toolBtn} onPress={onStartDissolve}>
              <Text style={styles.toolText}>{t('table.dissolve')}</Text>
            </Pressable>
          </>
        )}
      </View>

      {isHost && humanSeats.length > 0 && (
        <View style={styles.hostPanel}>
          {humanSeats.map((seat) => (
            <View key={seat.userId} style={styles.hostRow}>
              <Text style={styles.hostName} numberOfLines={1}>
                {seat.nickname}
              </Text>
              {seat.userId !== undefined && (
                <>
                  <Pressable style={styles.hostAction} onPress={() => onKick(seat.userId!)}>
                    <Text style={styles.hostActionText}>{t('table.kick')}</Text>
                  </Pressable>
                  <Pressable style={styles.hostAction} onPress={() => onReport(seat.userId!)}>
                    <Text style={styles.hostActionText}>{t('table.report')}</Text>
                  </Pressable>
                </>
              )}
            </View>
          ))}
        </View>
      )}

      <Modal visible={!!rebuyApproval && isHost} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('table.rebuy_approval_title')}</Text>
            <Text style={styles.modalBody}>
              {t('table.rebuy_approval_body', {
                name: rebuyApproval?.nickname,
                amount: rebuyApproval?.amount,
                seconds: rebuyApproval ? secondsLeft(rebuyApproval.deadline) : 0,
              })}
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.rejectBtn} onPress={onRejectRebuy}>
                <Text style={styles.rejectText}>{t('table.reject')}</Text>
              </Pressable>
              <Pressable style={styles.approveBtn} onPress={onApproveRebuy}>
                <Text style={styles.approveText}>{t('table.approve')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!dissolveVote} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('table.dissolve_vote_title')}</Text>
            <Text style={styles.modalBody}>
              {t('table.dissolve_vote_body', {
                current: dissolveVote?.currentApprovals ?? 0,
                required: dissolveVote?.requiredApprovals ?? 0,
                seconds: dissolveVote ? secondsLeft(dissolveVote.deadline) : 0,
              })}
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.rejectBtn} onPress={onDissolveReject}>
                <Text style={styles.rejectText}>{t('table.reject')}</Text>
              </Pressable>
              <Pressable style={styles.approveBtn} onPress={onDissolveApprove}>
                <Text style={styles.approveText}>{t('table.approve')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 48,
    alignSelf: 'center',
    backgroundColor: '#B71C1C',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
    zIndex: 10,
  },
  bannerText: { color: '#fff', fontWeight: '700' },
  toolbar: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    gap: 8,
    zIndex: 10,
  },
  toolBtn: {
    backgroundColor: '#2A2D35',
    borderColor: '#C9A227',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  toolText: { color: '#C9A227', fontSize: 12, fontWeight: '600' },
  hostPanel: {
    position: 'absolute',
    top: 56,
    left: 16,
    maxWidth: 200,
    zIndex: 9,
    gap: 4,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  hostName: { color: '#9E9E9E', fontSize: 11 },
  hostAction: {
    backgroundColor: '#1E2128',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  hostActionText: { color: '#F5F5F5', fontSize: 10 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#1E2128',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 360,
  },
  modalTitle: { color: '#F5F5F5', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  modalBody: { color: '#9E9E9E', lineHeight: 22, marginBottom: 20 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  rejectBtn: {
    borderWidth: 1,
    borderColor: '#9E9E9E',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rejectText: { color: '#9E9E9E', fontWeight: '600' },
  approveBtn: {
    backgroundColor: '#C9A227',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  approveText: { color: '#1A1A1A', fontWeight: '700' },
});
