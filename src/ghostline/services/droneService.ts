/**
 * Drone WebSocket Service
 * Handles real-time communication with the Python backend
 */

import type { ConnectionState, RawSample } from '../types'

type MessageHandler = (data: any) => void
type ConnectionHandler = (connected: boolean) => void

export class DroneService {
  private ws: WebSocket | null = null
  private reconnectTimer: number | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 2000
  private url: string

  private messageHandlers: Map<string, Set<MessageHandler>> = new Map()
  private connectionHandlers: Set<ConnectionHandler> = new Set()

  constructor(url: string = 'ws://localhost:8765') {
    this.url = url
  }

  // ========================================================================
  // Connection Management
  // ========================================================================

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve()
        return
      }

      try {
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          console.log('WebSocket connected')
          this.reconnectAttempts = 0
          this.notifyConnectionHandlers(true)
          resolve()
        }

        this.ws.onclose = () => {
          console.log('WebSocket disconnected')
          this.notifyConnectionHandlers(false)
          this.attemptReconnect()
        }

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          reject(error)
        }

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data)
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached')
      return
    }

    this.reconnectAttempts++
    console.log(`Reconnecting... (attempt ${this.reconnectAttempts})`)

    this.reconnectTimer = window.setTimeout(() => {
      this.connect().catch((error) => {
        console.error('Reconnect failed:', error)
      })
    }, this.reconnectDelay)
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  // ========================================================================
  // Message Handling
  // ========================================================================

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data)
      const type = message.type

      const handlers = this.messageHandlers.get(type)
      if (handlers) {
        handlers.forEach((handler) => handler(message.data))
      }

      // Also notify wildcard handlers
      const wildcardHandlers = this.messageHandlers.get('*')
      if (wildcardHandlers) {
        wildcardHandlers.forEach((handler) => handler(message))
      }
    } catch (error) {
      console.error('Failed to parse message:', error)
    }
  }

  on(type: string, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set())
    }
    this.messageHandlers.get(type)!.add(handler)

    // Return unsubscribe function
    return () => {
      this.messageHandlers.get(type)?.delete(handler)
    }
  }

  onConnectionChange(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler)
    return () => {
      this.connectionHandlers.delete(handler)
    }
  }

  private notifyConnectionHandlers(connected: boolean): void {
    this.connectionHandlers.forEach((handler) => handler(connected))
  }

  // ========================================================================
  // Command Execution
  // ========================================================================

  private async sendCommand(command: string, params: Record<string, any> = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        reject(new Error('WebSocket not connected'))
        return
      }

      const message = JSON.stringify({ command, params })

      // Listen for response
      const unsubscribe = this.on('command_response', (data) => {
        if (data.command === command) {
          unsubscribe()
          if (data.success) {
            resolve(data.data)
          } else {
            reject(new Error(data.error || 'Command failed'))
          }
        }
      })

      // Send command
      this.ws!.send(message)

      // Timeout after 10 seconds
      setTimeout(() => {
        unsubscribe()
        reject(new Error('Command timeout'))
      }, 10000)
    })
  }

  // ========================================================================
  // Drone Commands
  // ========================================================================

  async connectDrone(): Promise<ConnectionState> {
    return this.sendCommand('connect')
  }

  async disconnectDrone(): Promise<void> {
    return this.sendCommand('disconnect')
  }

  async takeoff(): Promise<void> {
    return this.sendCommand('takeoff')
  }

  async land(): Promise<void> {
    return this.sendCommand('land')
  }

  async emergencyStop(): Promise<void> {
    return this.sendCommand('emergency_stop')
  }

  async hover(duration: number = 1.0): Promise<void> {
    return this.sendCommand('hover', { duration })
  }

  async setControl(roll: number, pitch: number, yaw: number, throttle: number): Promise<void> {
    return this.sendCommand('set_control', { roll, pitch, yaw, throttle })
  }

  async move(duration?: number): Promise<void> {
    return this.sendCommand('move', { duration })
  }

  async resetMove(): Promise<void> {
    return this.sendCommand('reset_move')
  }

  async startRecording(): Promise<void> {
    return this.sendCommand('start_recording')
  }

  async stopRecording(): Promise<{ telemetry: RawSample[] }> {
    return this.sendCommand('stop_recording')
  }

  async getBattery(): Promise<number> {
    const result = await this.sendCommand('get_battery')
    return result.battery
  }

  async setTelemetryInterval(intervalMs: number): Promise<void> {
    return this.sendCommand('set_telemetry_interval', { interval: intervalMs })
  }

  // ========================================================================
  // Telemetry Streaming
  // ========================================================================

  onTelemetry(handler: (sample: RawSample) => void): () => void {
    return this.on('telemetry', handler)
  }

  onConnectionState(handler: (state: ConnectionState) => void): () => void {
    return this.on('connection_state', handler)
  }
}

// Singleton instance
export const droneService = new DroneService()
