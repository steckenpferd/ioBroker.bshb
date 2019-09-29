import {BoschSmartHomeBridge} from 'bosch-smart-home-bridge';
import {Bshb} from './main';
import {BshbLogger} from './bshb-logger';
import {Observable} from 'rxjs';
import {BshbDefinition} from './bshb-definition';

/**
 * This controller encapsulates bosch-smart-home-bridge and provides it to iobroker.bshb
 *
 * @author Christopher Holomek
 * @since 27.09.2019
 */
export class BshbController {

    private cachedDevices = new Map<string, any>();
    private cachedStates = new Map<string, any>();
    private cachedDeviceServices = new Map<string, any>();
    private boschSmartHomeBridge: BoschSmartHomeBridge;

    /**
     * Create a new instance of {@link BshbController}
     *
     * @param bshb
     *        instance of {@link Bshb}
     */
    constructor(private bshb: Bshb) {
        this.boschSmartHomeBridge = new BoschSmartHomeBridge(bshb.config.host, bshb.config.identifier, bshb.config.certsPath, new BshbLogger(bshb));
    }

    public getBshbClient() {
        return this.boschSmartHomeBridge.getBshcClient();
    }

    /**
     * Pair devices if needed
     *
     * @param systemPassword
     *        system password of BSHC
     */
    public pairDeviceIfNeeded(systemPassword: string) {

        let pairingDelay = 5000;
        if (this.bshb.config.pairingDelay && this.bshb.config.pairingDelay > 5000) {
            pairingDelay = this.bshb.config.pairingDelay;
        }

        return this.boschSmartHomeBridge.pairIfNeeded(this.bshb.config.name, systemPassword, pairingDelay, 100);
    }

    /**
     * iobroker state changed. Change it via bosch-smart-home-bridge
     *
     * @param id
     *        identifier of state
     * @param state
     *        new state value
     */
    public setState(id: string, state: ioBroker.State) {

        let cachedState = this.cachedStates.get(id);

        this.bshb.log.debug('Found cached state: ' + JSON.stringify(cachedState));

        const data: any = {
            '@type': cachedState.deviceService.state['@type'],
        };
        data[cachedState.stateKey] = state.val;

        this.bshb.log.debug('Data which will be send: ' + JSON.stringify(data));

        this.boschSmartHomeBridge.getBshcClient().putState(cachedState.deviceService.path, data).subscribe(value => {
            if (value) {
                this.bshb.log.info(JSON.stringify(value));
            } else {
                this.bshb.log.info('no response');
            }
        },error => {
            this.bshb.log.error(error);
        });
    }

    public setStateAck(deviceService: any) {
        if (deviceService.path) {
            const cachedDeviceService = this.cachedDeviceServices.get(deviceService.path);

            if (cachedDeviceService) {
                Object.keys(deviceService.state).forEach(stateKey => {
                    if (stateKey === '@type') {
                        return;
                    }
                    this.bshb.setState(this.getId(cachedDeviceService.device, cachedDeviceService.deviceService, stateKey),
                        {val: deviceService.state[stateKey], ack: true});
                });
            }
        }
    }

    private getId(device: any, deviceService: any, stateKey: string): string {
        let id: string;

        if (device) {
            id = device.id + '.' + deviceService.id;
        } else {
            id = deviceService.id;
        }
        return id + '.' + stateKey;
    }

    /**
     * detect devices will search for all devices and device states and load them to iobroker.
     */
    public detectDevices() : Observable<void> {
        this.bshb.log.info('start detecting devices. This may take a while.');

        return new Observable(observer => {
            this.boschSmartHomeBridge.getBshcClient().getDevices().subscribe((devices: any[]) => {
                devices.forEach(device => {
                    // this.cachedDevices.set(device.id, device);

                    this.bshb.setObject(device.id, {
                        type: 'device',
                        common: {
                            name: device.id,
                            read: true
                        },
                        native: {device: device},
                    });

                    this.cachedDevices.set(this.bshb.namespace + '.' + device.id, device);

                    // root device. This should be the bosch smart home controller only. It does not exist as a
                    // separate device so we add it multiple times but due to unique id this should be ok
                    this.bshb.setObject(device.rootDeviceId, {
                        type: 'device',
                        common: {
                            name: device.rootDeviceId,
                            read: true
                        },
                        native: {
                            device: {
                                id: device.rootDeviceId
                            }
                        },
                    });

                    this.cachedDevices.set(this.bshb.namespace + '.' + device.rootDeviceId, {
                        device: {
                            id: device.rootDeviceId
                        }
                    });
                });
                this.checkDeviceServices().subscribe(() => {
                    this.bshb.log.info('Detecting devices finished');

                    observer.next();
                    observer.complete();
                });
            });
        });
    }

    private checkDeviceServices() : Observable<void> {
        return new Observable(observer => {
            this.boschSmartHomeBridge.getBshcClient().getDevicesServices().subscribe((deviceServices: any[]) => {
                deviceServices.forEach(deviceService => {

                    this.bshb.getObject(deviceService.deviceId, (err, ioBrokerDevice) => {
                        if (err) {
                            this.bshb.log.error('Could not find device. This should not happen: deviceId=' + deviceService.deviceId + ', error=' + err);
                            return;
                        } else if (!ioBrokerDevice) {
                            this.bshb.log.error('Found device but value is undefined. This should not happen: deviceId=' + deviceService.deviceId);
                            return;
                        }
                        this.importChannels(ioBrokerDevice.native.device, deviceService);
                    });
                });
                observer.next();
                observer.complete();
            });
        });
    }

    private importChannels(device: any, deviceService: any) {
        let id: string;

        if (device) {
            id = device.id + '.' + deviceService.id;
        } else {
            id = deviceService.id;
        }

        const name = deviceService.id;

        this.bshb.setObject(id, {
            type: 'channel',
            common: {
                name: name,
                read: true,
            },
            native: {device: device, deviceService: deviceService},
        });

        if (deviceService.state) {
            this.importStates(id, device, deviceService);
        }
    }

    private importStates(idPrefix: string, device: any, deviceService: any) {
        // device service has a state
        Object.keys(deviceService.state).forEach(stateKey => {
            if (stateKey === '@type') {
                return;
            }
            this.importSimpleState(idPrefix, device, deviceService, stateKey, deviceService.state[stateKey]);
        });

        this.cachedDeviceServices.set(deviceService.path, {device: device, deviceService: deviceService});
    }

    private importSimpleState(idPrefix: string, device: any, deviceService: any, stateKey: string, stateValue: any) {
        const id = idPrefix + '.' + stateKey;

        this.bshb.setObject(id, {
            type: 'state',
            common: {
                name: stateKey,
                type: BshbDefinition.determineType(stateValue),
                role: BshbDefinition.determineRole(deviceService.state ? deviceService.state['@type'] : null, stateKey),
                read: true,
                write: true,
            },
            native: {device: device, deviceService: deviceService, state: stateKey},
        });

        this.cachedStates.set(this.bshb.namespace + '.' + id, {device: device, deviceService: deviceService, id: id, stateKey: stateKey});

        this.bshb.getState(id, (err, state) => {

            if (state) {
                if (state.val === stateValue) {
                    return;
                }
            }

            this.bshb.setState(id, {val: stateValue, ack: true});
        });
    }
}