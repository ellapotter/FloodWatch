import { TrafficSimulation } from '../trafficSimulation.js';

export class LevelTwoSimulation extends TrafficSimulation {
    getPacketIdPrefix() {return 'udp-packet';}

    resetBehavior() {
        this.activeClients = new Map();
        this.nextClientId = 1;
        this.incomingHistory = [];
        this.admittedHistory = [];
        this.dropHistory = [];
        this.incomingUdpPacketsTotal = 0;
        this.droppedPackets = 0;
        this.droppedLegitimatePackets = 0;
        this.processedUdpPackets = 0;
        this.applicationResponses = 0;
        this.attackDatagramsGenerated = 0;
        this.completedExchanges = 0;
        this.filteredAttackPackets = 0;
        this.blockedUdpPackets = 0;
        this.serverShutdown = false;
        this.blockedIndicatorUntil = 0;
        this.filteredIndicatorUntil = 0;

        this.effectiveCapacityKbps = this.configuration.capacityKbps;

        this.clientSlots.forEach((_, slotIndex) => {
            this.schedule(
                slotIndex * this.configuration.clientStartInterval,
                'spawn-client',
                { slotIndex },
            );
        });
    }

    makeClient(slotIndex, isAttackSource = false) {
        const slot = this.clientSlots[slotIndex];
        const number = this.nextClientId++;

        return {
            ...slot,
            id: `udp-client-${number}`,
            label: `Client ${number}`,
            slotIndex,
            isAttackSource,
            disruptedUntil: 0,
            awaitingResponse: false,
            completedExchanges: 0,
        };
    }

    spawnClient(slotIndex) {
        const occupied = [...this.activeClients.values()].some((client) => client.slotIndex === slotIndex,);

        if (occupied) return;

        const client = this.makeClient(slotIndex);
        this.activeClients.set(client.id, client);

        this.schedule(0, 'legitimate-send', { clientId: client.id });
    }

    removeClient(clientId, replace = true) {
        const client = this.activeClients.get(clientId);
        if (!client || client.isAttackSource) return;

        this.activeClients.delete(clientId);

        // Remove packets and events belonging to the old client.
        this.deletePackets((packet) => packet.clientId === clientId);
        this.cancelEvents((event) => event.clientId === clientId);

        if (replace) {
            this.schedule(this.configuration.replacementDelay, 'spawn-client', {slotIndex: client.slotIndex,});
        }
    }

    createAttackClient(slotIndex) {return this.makeClient(slotIndex, true);}

    getVisibleClients() {
        return [...this.activeClients.values()].map((client) => ({
            id: client.id,
            label: client.label,
            slotIndex: client.slotIndex,
            state: 'communicating',
            protocol: 'udp',
            behavior: client.isAttackSource ? 'suspicious' : client.disruptedUntil > this.simulationTime ? 'disrupted' : 'normal',
        }));
    }

    pruneHistory() {
        const cutoff = this.simulationTime - this.configuration.statisticsWindow;

        this.incomingHistory = this.incomingHistory.filter((event) => event.at > cutoff,);
        this.admittedHistory = this.admittedHistory.filter((event) => event.at > cutoff,);
        this.dropHistory = this.dropHistory.filter((time) => time > cutoff);
    } 

    getWindowCapacityBytes() { return (((this.effectiveCapacityKbps * 1000) / 8) *(this.configuration.statisticsWindow / 1000));}

    admitDatagram(client, isAttack) {
        const mitigation = this.activeMitigationId;

        if (mitigation === 'apply-upstream-udp-filtering') {
            const clientPacketInFlight = [...this.activePackets.values()].some((packet) => packet.clientId === client.id && !packet.filteredAtSource,);
            if (clientPacketInFlight) {
                this.filteredAttackPackets += 1;
                this.filteredIndicatorUntil = this.simulationTime + 1200;
                return 'filtered';
            }
        }

        if (mitigation === 'block-udp') {
            this.blockedUdpPackets += 1;
            this.blockedIndicatorUntil = this.simulationTime + 1200;
            return 'blocked';
        }

        this.pruneHistory();

        const bytes = this.configuration.datagramSizeBytes;

        this.incomingUdpPacketsTotal += 1;
        this.incomingHistory.push({ at: this.simulationTime, bytes });

        if (this.serverShutdown) {
            this.droppedPackets += 1;
            this.dropHistory.push(this.simulationTime);
            return 'dropped';
        }

        const admittedBytes = this.admittedHistory.reduce((total, event) => total + event.bytes,0,);

        if (admittedBytes + bytes > this.getWindowCapacityBytes()) {
            this.droppedPackets += 1;
            this.dropHistory.push(this.simulationTime);

            if (!this.serverShutdown) {
                this.serverShutdown = true;
                this.simulationPhase = 'server-unresponsive';
            }
            return 'dropped';
        }

        this.admittedHistory.push({ at: this.simulationTime, bytes });

        return 'admitted';
    }

    sendDatagram(client, isAttack = false, animate = true) {
        if (isAttack) this.attackDatagramsGenerated += 1;

        const outcome = this.admitDatagram(client, isAttack);

        if (outcome !== 'admitted') {
            if (animate && (outcome === 'blocked' || outcome === 'filtered' ||outcome === 'dropped')) {
                this.spawnPacket('UDP Datagram', client, this.server, {
                    clientId: client.id,
                    isAttack,
                    blockedByPolicy: outcome === 'blocked',
                    filteredAtSource: outcome === 'filtered',
                    droppedByCapacity: outcome === 'dropped',
                });
            }
            if (!isAttack) {
                if (outcome === 'dropped') {
                    this.droppedLegitimatePackets += 1;
                }
            }
            return;
        }   

        if (animate) {
            this.spawnPacket('UDP Datagram', client, this.server, {clientId: client.id,isAttack, });
        }
    }

    sendLegitimateDatagram(client) {
        if (client.awaitingResponse) return;

        client.awaitingResponse = true;
        this.sendDatagram(client, false);
    }

    sendFloodPacket(client) {
        this.sendDatagram(client, true);
        // The extra flood traffic still consumes capacity without adding a
        // second overlapping packet card to the network diagram.
        if (this.activeMitigationId === 'increase-bandwidth') this.sendDatagram(client, true, false);
    }

    getFloodPacketType() {return 'UDP Datagram';}

    disruptClient(client) {
        if (!client || client.isAttackSource) return;
        if (client.disruptedUntil > this.simulationTime) return;

        client.awaitingResponse = false;

        client.disruptedUntil = this.simulationTime + this.configuration.clientDisruptionDuration;

        this.schedule(
            this.configuration.clientDisruptionDuration,
            'remove-client',
            { clientId: client.id },
        );
    }

    handleEvent(event) {
        if (this.handleFloodEvent(event)) return;

        if (event.type === 'spawn-client') {
            this.spawnClient(event.slotIndex);
            return;
        }

        const client = event.clientId ? this.activeClients.get(event.clientId) : null;

        if (!client) return;
        if (event.type === 'legitimate-send') {
            if (!client.isAttackSource) {
                this.sendLegitimateDatagram(client);
            }
        } else if (event.type === 'application-response') {
            if (this.activeMitigationId === 'block-udp') return;

            this.applicationResponses += 1;

            this.spawnPacket('UDP Response', this.server, client, {
                clientId: client.id,
                isAttack: event.isAttack === true,
            });
        } else if (event.type === 'remove-client') {
                this.removeClient(client.id);
        }
    }

    handlePacketArrival(packet) {
        const client = this.activeClients.get(packet.clientId);
        if (!client) return;

        if (packet.type === 'UDP Datagram') {
            if (packet.blockedByPolicy ||packet.filteredAtSource ||packet.droppedByCapacity) {
                if (!packet.isAttack) this.disruptClient(client);
                return;
            }
            this.processedUdpPackets += 1;

            this.schedule(this.configuration.responseDelay, 'application-response', {
                clientId: client.id,
                isAttack: packet.isAttack,
            });

            return;
        }

        if (packet.type === 'UDP Response') {
            if (client.isAttackSource) return;

            client.awaitingResponse = false;
            client.completedExchanges += 1;
            this.completedExchanges += 1;

            if (client.completedExchanges >= this.configuration.exchangesPerClient) {
                this.removeClient(client.id);
            } else {
                this.schedule(
                    this.configuration.normalTrafficInterval,
                    'legitimate-send',
                    { clientId: client.id },
                );
            }
        }
    }

    getMitigationActions() {
        const apply = (id) => () => this.applyMitigationEffects(id);

        return {
        'apply-upstream-udp-filtering': apply('apply-upstream-udp-filtering'),
        'block-udp': apply('block-udp'),
        'increase-bandwidth': apply('increase-bandwidth'),
        };
    }

    canApplyMitigation() {return this.attackClientSlot !== null;}

    packetSnapshotExtras(packet) {
        return {
            willBeBlocked: packet.blockedByPolicy === true,
            willBeFiltered: packet.filteredAtSource === true,
        };
    }

    applyMitigationEffects(mitigationId) {
        this.effectiveCapacityKbps = mitigationId === 'increase-bandwidth' ? this.configuration.increasedCapacityKbps : this.configuration.capacityKbps;

        this.blockedIndicatorUntil = 0;
        this.filteredIndicatorUntil = 0;
        this.recoveryComplete = false;

        if (mitigationId === 'apply-upstream-udp-filtering') {
            this.serverShutdown = false;
            this.simulationPhase = 'network-recovery';
        } else if (mitigationId === 'block-udp') {
            this.serverShutdown = true;
            this.simulationPhase = 'mitigation-ineffective';
        } else if (mitigationId === 'increase-bandwidth') {
            this.serverShutdown = false;
            this.simulationPhase = 'mitigation-ineffective';
        }
    }

    updateSimulationPhase() {
        this.pruneHistory();

        if (this.activeMitigationId === 'apply-upstream-udp-filtering') {
            const state = this.getState();
            if (!state.congestionActive && state.bandwidthPercent <= 100) {
                this.recoveryComplete = true;
                this.simulationPhase = 'network-recovered';
            } else {
                this.simulationPhase = 'network-recovery';
            }
            return;
        }
        if (this.activeMitigationId) {
            this.simulationPhase = 'mitigation-ineffective';
            return;
        }
        if (this.serverShutdown) {
            this.simulationPhase = 'server-unresponsive';
            return;
        }
        if (this.dropHistory.length > 0) {
            this.simulationPhase = 'attack-established';
        } else if (this.getState().highUtilizationActive) {
            this.simulationPhase = 'network-pressure';
        }
    }

    getState() {
        this.pruneHistory();

        const windowSeconds = this.configuration.statisticsWindow / 1000;

        const offeredBytes = this.incomingHistory.reduce((total, event) => total + event.bytes,0, );

        const bandwidthKbps = (offeredBytes * 8) / windowSeconds / 1000;

        const bandwidthPercent = (bandwidthKbps / this.effectiveCapacityKbps) * 100;

        const congestionActive = this.dropHistory.length > 0;

        const filteringActive = this.activeMitigationId === 'apply-upstream-udp-filtering';

        return {
            isPlaying: this.isPlaying,
            simulationPhase: this.simulationPhase,
            visibleClients: this.getVisibleClients(),
            activePackets: this.getPackets(),
            incomingUdpPacketsTotal: this.incomingUdpPacketsTotal,
            droppedPackets: this.droppedPackets,
            droppedLegitimatePackets: this.droppedLegitimatePackets,
            bandwidthKbps,
            bandwidthPercent,
            networkCapacityKbps: this.effectiveCapacityKbps,

            congestionActive,
            highUtilizationActive: bandwidthPercent >= 80,
            serverUnderPressure: congestionActive || bandwidthPercent >= 80,

            processedUdpPackets: this.processedUdpPackets,
            applicationResponses: this.applicationResponses,
            completedExchanges: this.completedExchanges,

            attackDatagramsGenerated: this.attackDatagramsGenerated,
            attackClientSlot: this.attackClientSlot,

            filteredAttackPackets: this.filteredAttackPackets,
            blockedUdpPackets: this.blockedUdpPackets,

            upstreamFilteringActive: filteringActive,
            udpTrafficBlocked: this.activeMitigationId === 'block-udp',

            recoveryComplete: this.recoveryComplete,
            activeMitigationId: this.activeMitigationId,
            serverShutdown: this.serverShutdown,

            blockedIndicatorActive: this.simulationTime < this.blockedIndicatorUntil,
            filteredIndicatorActive: this.simulationTime < this.filteredIndicatorUntil,

            udpTrafficBlocked: this.activeMitigationId === 'block-udp',

            upstreamFilteringActive: this.activeMitigationId === 'apply-upstream-udp-filtering',
        };
    }
}
