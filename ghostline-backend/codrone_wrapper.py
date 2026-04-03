"""
CoDrone EDU SDK Wrapper
Provides a clean interface to the CoDrone EDU Python SDK with proper error handling
and state management.
"""

import time
from typing import Optional, Dict, Any, List
from codrone_edu.drone import Drone


class CoDroneWrapper:
    """Wrapper for CoDrone EDU SDK with enhanced telemetry and control."""
    
    def __init__(self):
        self.drone = Drone()
        self.is_connected = False
        self.is_flying = False
        self.last_error: Optional[str] = None
        self.recording = False
        self.telemetry_buffer: List[Dict[str, Any]] = []
        
    def connect(self) -> bool:
        """Connect to CoDrone EDU."""
        try:
            self.drone.pair()
            self.is_connected = True
            self.last_error = None
            return True
        except Exception as e:
            self.last_error = f"Connection failed: {str(e)}"
            self.is_connected = False
            return False
    
    def disconnect(self) -> bool:
        """Disconnect from CoDrone EDU."""
        try:
            if self.is_flying:
                self.emergency_stop()
            self.drone.close()
            self.is_connected = False
            return True
        except Exception as e:
            self.last_error = f"Disconnect failed: {str(e)}"
            return False
    
    def get_connection_state(self) -> Dict[str, Any]:
        """Get current connection state."""
        return {
            "drone": "connected" if self.is_connected else "disconnected",
            "controller": "connected" if self.is_connected else "disconnected",
            "lastHeartbeat": time.time() * 1000 if self.is_connected else None,
            "errorMessage": self.last_error
        }
    
    # ========================================================================
    # Flight Control
    # ========================================================================
    
    def takeoff(self) -> bool:
        """Execute takeoff sequence."""
        try:
            if not self.is_connected:
                raise Exception("Drone not connected")
            
            self.drone.takeoff()
            self.is_flying = True
            return True
        except Exception as e:
            self.last_error = f"Takeoff failed: {str(e)}"
            return False
    
    def land(self) -> bool:
        """Execute landing sequence."""
        try:
            if not self.is_connected:
                raise Exception("Drone not connected")
            
            self.drone.land()
            self.is_flying = False
            return True
        except Exception as e:
            self.last_error = f"Landing failed: {str(e)}"
            return False
    
    def emergency_stop(self) -> bool:
        """Emergency stop - immediately stops motors."""
        try:
            self.drone.emergency_stop()
            self.is_flying = False
            return True
        except Exception as e:
            self.last_error = f"Emergency stop failed: {str(e)}"
            return False
    
    def hover(self, duration: float = 1.0) -> bool:
        """Hover in place for specified duration."""
        try:
            self.drone.hover(duration)
            return True
        except Exception as e:
            self.last_error = f"Hover failed: {str(e)}"
            return False
    
    def set_control(self, roll: int, pitch: int, yaw: int, throttle: int) -> bool:
        """
        Set control values (sticky - persist until changed).
        Values range from -100 to 100.
        """
        try:
            self.drone.set_roll(roll)
            self.drone.set_pitch(pitch)
            self.drone.set_yaw(yaw)
            self.drone.set_throttle(throttle)
            return True
        except Exception as e:
            self.last_error = f"Set control failed: {str(e)}"
            return False
    
    def move(self, duration: Optional[float] = None) -> bool:
        """
        Execute movement with current control values.
        If duration is None, continues indefinitely until reset.
        """
        try:
            if duration is not None:
                self.drone.move(duration)
            else:
                self.drone.move()
            return True
        except Exception as e:
            self.last_error = f"Move failed: {str(e)}"
            return False
    
    def reset_move(self) -> bool:
        """Reset all motion variables to zero."""
        try:
            self.drone.set_roll(0)
            self.drone.set_pitch(0)
            self.drone.set_yaw(0)
            self.drone.set_throttle(0)
            return True
        except Exception as e:
            self.last_error = f"Reset move failed: {str(e)}"
            return False
    
    # ========================================================================
    # Telemetry & Sensors
    # ========================================================================
    
    def get_sensor_data(self) -> Dict[str, Any]:
        """
        Get bulk sensor data (31 values - faster than individual requests).
        Returns comprehensive telemetry snapshot.
        """
        try:
            sensor_data = self.drone.get_sensor_data()
            
            return {
                "timestamp": time.time() * 1000,
                "accelX": sensor_data[0] if len(sensor_data) > 0 else 0,
                "accelY": sensor_data[1] if len(sensor_data) > 1 else 0,
                "accelZ": sensor_data[2] if len(sensor_data) > 2 else 0,
                "gyroX": sensor_data[3] if len(sensor_data) > 3 else 0,
                "gyroY": sensor_data[4] if len(sensor_data) > 4 else 0,
                "gyroZ": sensor_data[5] if len(sensor_data) > 5 else 0,
                "angleX": sensor_data[6] if len(sensor_data) > 6 else 0,
                "angleY": sensor_data[7] if len(sensor_data) > 7 else 0,
                "angleZ": sensor_data[8] if len(sensor_data) > 8 else 0,
                "x": sensor_data[9] if len(sensor_data) > 9 else 0,
                "y": sensor_data[10] if len(sensor_data) > 10 else 0,
                "z": sensor_data[11] if len(sensor_data) > 11 else 0,
                "frontRange": sensor_data[12] if len(sensor_data) > 12 else 0,
                "bottomRange": sensor_data[13] if len(sensor_data) > 13 else 0,
                "movementState": sensor_data[14] if len(sensor_data) > 14 else 0,
                "batteryPercent": sensor_data[15] if len(sensor_data) > 15 else 0,
                "speedSetting": sensor_data[16] if len(sensor_data) > 16 else 0,
                "errorState": sensor_data[17] if len(sensor_data) > 17 else 0,
            }
        except Exception as e:
            self.last_error = f"Get sensor data failed: {str(e)}"
            return self._empty_sensor_data()
    
    def get_position_data(self) -> Dict[str, Any]:
        """Get optical flow position data."""
        try:
            pos = self.drone.get_position_data()
            return {
                "time": time.time() * 1000,
                "x": pos[1] if len(pos) > 1 else 0,
                "y": pos[2] if len(pos) > 2 else 0,
                "z": pos[3] if len(pos) > 3 else 0,
            }
        except Exception as e:
            self.last_error = f"Get position failed: {str(e)}"
            return {"time": time.time() * 1000, "x": 0, "y": 0, "z": 0}
    
    def get_error_data(self) -> Dict[str, Any]:
        """Get error state data."""
        try:
            error_data = self.drone.get_error_data()
            return {
                "lowBattery": bool(error_data & 0x01),
                "opticalFlowIssue": bool(error_data & 0x02),
                "rangeSensorIssue": bool(error_data & 0x04),
                "takeoffFailure": bool(error_data & 0x08),
                "calibrationIssue": bool(error_data & 0x10),
                "stabilityIssue": bool(error_data & 0x20),
            }
        except Exception as e:
            self.last_error = f"Get error data failed: {str(e)}"
            return {
                "lowBattery": False,
                "opticalFlowIssue": False,
                "rangeSensorIssue": False,
                "takeoffFailure": False,
                "calibrationIssue": False,
                "stabilityIssue": False,
            }
    
    def get_battery(self) -> int:
        """Get battery percentage."""
        try:
            return self.drone.get_battery()
        except Exception as e:
            self.last_error = f"Get battery failed: {str(e)}"
            return 0
    
    # ========================================================================
    # Controller Input
    # ========================================================================
    
    def get_joystick_data(self) -> Dict[str, int]:
        """Get raw joystick data from controller."""
        try:
            return {
                "leftX": self.drone.get_left_joystick_x(),
                "leftY": self.drone.get_left_joystick_y(),
                "rightX": self.drone.get_right_joystick_x(),
                "rightY": self.drone.get_right_joystick_y(),
            }
        except Exception as e:
            self.last_error = f"Get joystick data failed: {str(e)}"
            return {"leftX": 0, "leftY": 0, "rightX": 0, "rightY": 0}
    
    def get_button_data(self) -> Dict[str, bool]:
        """Get button press states from controller."""
        try:
            return {
                "l1": self.drone.l1_pressed(),
                "r1": self.drone.r1_pressed(),
                # Add more buttons as needed
            }
        except Exception as e:
            self.last_error = f"Get button data failed: {str(e)}"
            return {"l1": False, "r1": False}
    
    # ========================================================================
    # Recording & Telemetry
    # ========================================================================
    
    def start_recording(self) -> bool:
        """Start telemetry recording."""
        self.recording = True
        self.telemetry_buffer = []
        return True
    
    def stop_recording(self) -> List[Dict[str, Any]]:
        """Stop recording and return captured telemetry."""
        self.recording = False
        return self.telemetry_buffer.copy()
    
    def capture_telemetry_sample(self) -> Dict[str, Any]:
        """
        Capture a complete telemetry sample.
        This should be called at fixed intervals during recording.
        """
        sample = {
            "timestamp": time.time() * 1000,
            "joystick": self.get_joystick_data(),
            "buttons": self.get_button_data(),
            "command": {
                "roll": 0,  # Would need to track current command state
                "pitch": 0,
                "yaw": 0,
                "throttle": 0,
            },
            "sensor": self.get_sensor_data(),
            "position": self.get_position_data(),
        }
        
        if self.recording:
            self.telemetry_buffer.append(sample)
        
        return sample
    
    # ========================================================================
    # Helper Methods
    # ========================================================================
    
    def _empty_sensor_data(self) -> Dict[str, Any]:
        """Return empty sensor data structure."""
        return {
            "timestamp": time.time() * 1000,
            "accelX": 0, "accelY": 0, "accelZ": 0,
            "gyroX": 0, "gyroY": 0, "gyroZ": 0,
            "angleX": 0, "angleY": 0, "angleZ": 0,
            "x": 0, "y": 0, "z": 0,
            "frontRange": 0, "bottomRange": 0,
            "movementState": 0, "batteryPercent": 0,
            "speedSetting": 0, "errorState": 0,
        }
