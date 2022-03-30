import { createSlice } from '@reduxjs/toolkit'
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { CAIP2, CAIP10, caip10 } from '@shapeshiftoss/caip'
import { ChainAdapter } from '@shapeshiftoss/chain-adapters'
import { CosmosSdkBaseAdapter } from '@shapeshiftoss/chain-adapters/dist/cosmossdk/CosmosSdkBaseAdapter'
import { chainAdapters, ChainTypes } from '@shapeshiftoss/types'
import { getChainAdapters } from 'context/PluginProvider/PluginProvider'

export type PubKey = string
type AllStakingDataArgs = { accountSpecifier: CAIP10 }

type AllValidatorDataArgs = { chainId: CAIP2 }

export type StakingDataStatus = 'idle' | 'loading' | 'loaded'

export type Staking = {
  delegations: chainAdapters.cosmos.Delegation[]
  redelegations: chainAdapters.cosmos.Redelegation[]
  undelegations: chainAdapters.cosmos.Undelegation[]
  rewards: chainAdapters.cosmos.ValidatorReward[]
}

export type Validators = {
  validators: chainAdapters.cosmos.Validator[]
}

export type StakingDataById = {
  [k: PubKey]: Staking
}

export type StakingData = {
  byAccountSpecifier: StakingDataById
  status: StakingDataStatus
  byvalidator: ValidatorDataByPubKey
}

export type ValidatorDataByPubKey = {
  [k: PubKey]: chainAdapters.cosmos.Validator
}

export type StakingPayload = {
  payload: {
    pubKey: PubKey
    stakingData: Staking
  }
}
const initialState: StakingData = {
  byAccountSpecifier: {},
  byvalidator: {},
  status: 'idle'
}

const updateOrInsert = (
  stakingDataState: StakingData,
  accountSpecifier: CAIP10,
  currentStakingData: Staking
) => {
  stakingDataState.byAccountSpecifier[accountSpecifier] = currentStakingData
}

const updateOrInsertValidatorData = (
  stakingDataState: StakingData,
  validators: chainAdapters.cosmos.Validator[]
) => {
  validators.forEach(validator => {
    stakingDataState.byvalidator[validator.address] = validator
  })
}

type StakingDataStatusPayload = { payload: StakingDataStatus }

export const stakingData = createSlice({
  name: 'stakingData',
  initialState,
  reducers: {
    clear: () => initialState,
    setStatus: (state, { payload }: StakingDataStatusPayload) => {
      state.status = payload
    },
    upsertStakingData: (
      stakingDataState,
      { payload }: { payload: { accountSpecifier: CAIP10; stakingData: Staking } }
    ) => {
      // TODO(gomes): Improve the structure of this when we have cosmos websocket, for now this just inserts
      updateOrInsert(stakingDataState, payload.accountSpecifier, payload.stakingData)
    },
    upsertValidatorData: (
      stakingDataState,
      { payload }: { payload: { validators: chainAdapters.cosmos.Validator[] } }
    ) => {
      // TODO(gomes): Improve the structure of this when we have cosmos websocket, for now this just inserts
      updateOrInsertValidatorData(stakingDataState, payload.validators)
    }
  }
})

export const stakingDataApi = createApi({
  reducerPath: 'stakingDataApi',
  // not actually used, only used to satisfy createApi, we use a custom queryFn
  baseQuery: fetchBaseQuery({ baseUrl: '/' }),
  // refetch if network connection is dropped, useful for mobile
  refetchOnReconnect: true,
  endpoints: build => ({
    getStakingData: build.query<Staking, AllStakingDataArgs>({
      queryFn: async ({ accountSpecifier }, { dispatch }) => {
        const { caip2, account } = caip10.fromCAIP10(accountSpecifier)
        const chainAdapters = getChainAdapters()
        const adapter = (await chainAdapters.byChainId(caip2)) as ChainAdapter<ChainTypes.Cosmos>
        dispatch(stakingData.actions.setStatus('loading'))
        try {
          const data = await adapter.getAccount(account)

          const {
            chainSpecific: { delegations, redelegations, undelegations, rewards }
          } = data

          const currentStakingData = {
            delegations,
            redelegations,
            undelegations,
            rewards
          }

          dispatch(
            stakingData.actions.upsertStakingData({
              stakingData: currentStakingData,
              accountSpecifier
            })
          )
          return { data: currentStakingData }
        } catch (e) {
          console.error('Error fetching staking data for ', account)
          return {
            error: {
              data: `Error fetching staking data for ${account}`,
              status: 500
            }
          }
        } finally {
          dispatch(stakingData.actions.setStatus('loaded'))
        }
      }
    }),
    getValidatorData: build.query<Validators, AllValidatorDataArgs>({
      queryFn: async ({ chainId }, { dispatch }) => {
        const chainAdapters = getChainAdapters()
        const adapter = (await chainAdapters.byChainId(
          chainId
        )) as CosmosSdkBaseAdapter<ChainTypes.Cosmos>
        dispatch(stakingData.actions.setStatus('loading'))
        try {
          const data = await adapter.getValidators()
          dispatch(
            stakingData.actions.upsertValidatorData({
              validators: data
            })
          )
          return {
            data: {
              validators: data
            }
          }
        } catch (e) {
          console.error('Error fetching validator data', e)
          return {
            error: {
              data: `Error fetching staking data`,
              status: 500
            }
          }
        } finally {
          dispatch(stakingData.actions.setStatus('loaded'))
        }
      }
    })
  })
})