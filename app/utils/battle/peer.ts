import { unseal, seal } from '~/utils/battle/crypto'
import { battleUri, deleteSignal, sendSignal, watchSignals, type Signal } from '~/utils/battle/signaling'

const ICE_SERVERS: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }]
const GATHER_TIMEOUT_MS = 4000
const CONNECT_TIMEOUT_MS = 45000

export interface Peer {
  did: string
  pc: RTCPeerConnection
  channel: RTCDataChannel
}

export interface Link<Out> {
  send: (message: Out) => void
  close: () => void
}

class BattleConnectError extends Error {
  override name = 'BattleConnectError'
}

function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new BattleConnectError('Timed out')), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

function gathered(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer)
      pc.removeEventListener('icegatheringstatechange', check)
      resolve()
    }
    const check = () => {
      if (pc.iceGatheringState === 'complete') done()
    }
    const timer = setTimeout(done, GATHER_TIMEOUT_MS)
    pc.addEventListener('icegatheringstatechange', check)
  })
}

async function describe(pc: RTCPeerConnection, type: 'offer' | 'answer'): Promise<RTCSessionDescriptionInit> {
  await pc.setLocalDescription(type === 'offer' ? await pc.createOffer() : await pc.createAnswer())
  await gathered(pc)
  return pc.localDescription!.toJSON()
}

function opened(channel: RTCDataChannel): Promise<void> {
  if (channel.readyState === 'open') return Promise.resolve()
  return new Promise((resolve, reject) => {
    channel.addEventListener('open', () => resolve(), { once: true })
    channel.addEventListener('close', () => reject(new BattleConnectError('Channel closed')), { once: true })
  })
}

interface Offer {
  pc: RTCPeerConnection
  channel: RTCDataChannel
  description: RTCSessionDescriptionInit
}

interface Answer {
  pc: RTCPeerConnection
  channel: Promise<RTCDataChannel>
  description: RTCSessionDescriptionInit
}

async function createOffer(): Promise<Offer> {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
  const channel = pc.createDataChannel('battle', { ordered: true })
  return { pc, channel, description: await describe(pc, 'offer') }
}

async function answerOffer(offer: RTCSessionDescriptionInit): Promise<Answer> {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
  const incoming = new Promise<RTCDataChannel>((resolve) =>
    pc.addEventListener('datachannel', (event) => resolve(event.channel), { once: true }),
  )
  try {
    await pc.setRemoteDescription(offer)
    const description = await describe(pc, 'answer')
    const channel = timeout(incoming, CONNECT_TIMEOUT_MS).then(async (c) => {
      await timeout(opened(c), CONNECT_TIMEOUT_MS)
      return c
    })
    channel.catch(() => undefined)
    return { pc, channel, description }
  } catch (err) {
    pc.close()
    throw err
  }
}

async function completeOffer(offer: Offer, answer: RTCSessionDescriptionInit): Promise<void> {
  await offer.pc.setRemoteDescription(answer)
  await timeout(opened(offer.channel), CONNECT_TIMEOUT_MS)
}

function firstSignal<T>(subject: string, from: string, key: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let stop = () => {}
    const timer = setTimeout(() => {
      stop()
      reject(new BattleConnectError('No answer'))
    }, CONNECT_TIMEOUT_MS)
    stop = watchSignals(
      subject,
      (signal) => {
        unseal<T>(key, signal.payload).then(
          (value) => {
            clearTimeout(timer)
            stop()
            resolve(value)
          },
          () => undefined,
        )
      },
      from,
    )
  })
}

export async function connectToHost(hostDid: string, battleId: string, key: string): Promise<Peer> {
  const offer = await createOffer()
  try {
    const mine = await sendSignal(battleUri(hostDid, battleId), await seal(key, offer.description))
    try {
      await completeOffer(offer, await firstSignal<RTCSessionDescriptionInit>(mine.uri, hostDid, key))
      return { did: hostDid, pc: offer.pc, channel: offer.channel }
    } finally {
      void deleteSignal(mine.rkey)
    }
  } catch (err) {
    offer.pc.close()
    throw err
  }
}

async function acceptGuest(signal: Signal, key: string): Promise<Peer> {
  const answer = await answerOffer(await unseal<RTCSessionDescriptionInit>(key, signal.payload))
  try {
    const reply = await sendSignal(signal.uri, await seal(key, answer.description))
    try {
      return { did: signal.did, pc: answer.pc, channel: await answer.channel }
    } finally {
      void deleteSignal(reply.rkey)
    }
  } catch (err) {
    answer.pc.close()
    throw err
  }
}

export function acceptGuests(
  hostDid: string,
  battleId: string,
  key: string,
  onGuest: (peer: Peer) => void,
): () => void {
  return watchSignals(battleUri(hostDid, battleId), (signal) => {
    acceptGuest(signal, key).then(onGuest, (err) => console.error('[opendeck] a guest could not connect', err))
  })
}

export function link<In, Out>(peer: Peer, onMessage: (message: In) => void, onClose: () => void): Link<Out> {
  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    peer.channel.close()
    peer.pc.close()
    onClose()
  }
  peer.channel.addEventListener('message', (event) => {
    try {
      onMessage(JSON.parse(String(event.data)) as In)
    } catch (err) {
      console.error('[opendeck] ignored a malformed battle message', err)
    }
  })
  peer.channel.addEventListener('close', close)
  peer.pc.addEventListener('connectionstatechange', () => {
    if (peer.pc.connectionState === 'failed' || peer.pc.connectionState === 'closed') close()
  })
  return {
    send: (message) => {
      if (!closed && peer.channel.readyState === 'open') peer.channel.send(JSON.stringify(message))
    },
    close,
  }
}
