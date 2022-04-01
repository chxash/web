import { ArrowForwardIcon } from '@chakra-ui/icons'
import {
  Box,
  Button,
  Flex,
  HStack,
  Skeleton,
  SkeletonCircle,
  Tag,
  TagLabel
} from '@chakra-ui/react'
import { CAIP19 } from '@shapeshiftoss/caip'
import { AprTag } from 'plugins/cosmos/components/AprTag/AprTag'
import { MouseEvent, useEffect, useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import { Column, Row } from 'react-table'
import { Amount } from 'components/Amount/Amount'
import { AssetIcon } from 'components/AssetIcon'
import { Card } from 'components/Card/Card'
import { ReactTable } from 'components/ReactTable/ReactTable'
import { RawText, Text } from 'components/Text'
import { useModal } from 'context/ModalProvider/ModalProvider'
import { bnOrZero } from 'lib/bignumber/bignumber'
import {
  selectAssetByCAIP19,
  selectMarketDataById,
  selectPubkeyishByChainId
} from 'state/slices/selectors'
import {
  ASSET_ID_TO_DENOM,
  selectNonloadedValidators,
  selectSingleValidator,
  selectStakingDataStatus,
  selectStakingOpportunityDataByDenom,
  selectValidatorStatus,
  StakingOpportunity
} from 'state/slices/stakingDataSlice/selectors'
import { stakingDataApi } from 'state/slices/stakingDataSlice/stakingDataSlice'
import { useAppDispatch, useAppSelector } from 'state/store'

const SHAPESHIFT_VALIDATOR_ADDRESS = 'cosmosvaloper199mlc7fr6ll5t54w7tts7f4s0cvnqgc59nmuxf'

type StakingOpportunitiesProps = {
  assetId: CAIP19
}

type ValidatorNameProps = {
  moniker: string
  isStaking: boolean
}

export const ValidatorName = ({ moniker, isStaking }: ValidatorNameProps) => {
  const isLoaded = true
  const assetIcon = isStaking
    ? 'https://assets.coincap.io/assets/icons/eth@2x.png'
    : 'https://assets.coingecko.com/coins/images/16724/small/osmo.png?1632763885'

  return (
    <Box cursor='pointer'>
      <Flex alignItems='center' maxWidth='180px' mr={'-20px'}>
        <SkeletonCircle boxSize='8' isLoaded={isLoaded} mr={4}>
          <AssetIcon src={assetIcon} boxSize='8' />
        </SkeletonCircle>
        <Skeleton isLoaded={isLoaded} cursor='pointer'>
          {isStaking && (
            <Tag colorScheme='blue'>
              <TagLabel>{moniker}</TagLabel>
            </Tag>
          )}
          {!isStaking && <RawText fontWeight='bold'>{`${moniker}`}</RawText>}
        </Skeleton>
      </Flex>
    </Box>
  )
}

export const StakingOpportunities = ({ assetId }: StakingOpportunitiesProps) => {
  const stakingDataStatus = useAppSelector(selectStakingDataStatus)
  const isStakingDataLoaded = stakingDataStatus === 'loaded'
  const validatorStatus = useAppSelector(selectValidatorStatus)
  const isValidatorDataLoaded = validatorStatus === 'loaded'
  const isLoaded = isStakingDataLoaded && isValidatorDataLoaded
  const asset = useAppSelector(state => selectAssetByCAIP19(state, assetId))
  const marketData = useAppSelector(state => selectMarketDataById(state, assetId))
  const dispatch = useAppDispatch()

  const accountSpecifiersForChainId = useAppSelector(state =>
    selectPubkeyishByChainId(state, asset?.caip2)
  )
  const accountSpecifier = accountSpecifiersForChainId?.[0]

  const stakingOpportunities = useAppSelector(state =>
    selectStakingOpportunityDataByDenom(
      state,
      accountSpecifier,
      SHAPESHIFT_VALIDATOR_ADDRESS,
      ASSET_ID_TO_DENOM[asset.caip19]
    )
  )
  const shapeshiftValidator = useAppSelector(state =>
    selectSingleValidator(state, accountSpecifier, SHAPESHIFT_VALIDATOR_ADDRESS)
  )
  const stakingOpportunityDefault = [
    {
      ...shapeshiftValidator
    }
  ]
  const nonLoadedValidators = useAppSelector(state =>
    selectNonloadedValidators(state, accountSpecifier)
  )
  const isStaking = stakingOpportunities.length !== 0

  useEffect(() => {
    ;(async () => {
      if (!accountSpecifier?.length || isStakingDataLoaded) return

      dispatch(
        stakingDataApi.endpoints.getStakingData.initiate(
          { accountSpecifier },
          { forceRefetch: true }
        )
      )
    })()
  }, [accountSpecifier, isStakingDataLoaded, dispatch])

  useEffect(() => {
    ;(async () => {
      if (isValidatorDataLoaded) return

      dispatch(
        stakingDataApi.endpoints.getAllValidatorsData.initiate(
          { chainId: 'cosmos:cosmoshub-4' },
          { forceRefetch: true }
        )
      )
    })()
  }, [isValidatorDataLoaded, dispatch])

  useEffect(() => {
    ;(async () => {
      if (!isValidatorDataLoaded || !nonLoadedValidators?.length) return

      nonLoadedValidators.forEach(validatorAddress => {
        dispatch(
          stakingDataApi.endpoints.getValidatorData.initiate(
            { chainId: 'cosmos:cosmoshub-4', validatorAddress: validatorAddress },
            { forceRefetch: true }
          )
        )
      })
    })()
  }, [isValidatorDataLoaded, nonLoadedValidators, dispatch])

  const { cosmosGetStarted, cosmosStaking } = useModal()

  const handleGetStartedClick = (e: MouseEvent<HTMLButtonElement>) => {
    cosmosGetStarted.open({ assetId: 'cosmos:cosmoshub-4/slip44:118' })
    e.stopPropagation()
  }

  const handleStakedClick = (values: Row<object>) => {
    cosmosStaking.open({
      assetId: 'cosmos:cosmoshub-4/slip44:118',
      validatorAddress: (values.original as StakingOpportunity).address
    })
  }

  const columns: Column<StakingOpportunity>[] = useMemo(
    () => [
      {
        Header: <Text translation='defi.validator' />,
        accessor: 'moniker',
        display: { base: 'table-cell' },
        Cell: ({ value }: { value: string }) => (
          <ValidatorName moniker={value} isStaking={isStaking} />
        ),
        disableSortBy: true
      },
      {
        Header: <Text translation='defi.apr' />,
        accessor: 'apr',
        display: { base: 'table-cell' },
        Cell: ({ value }: { value: string }) => (
          <Skeleton isLoaded={isLoaded}>
            <AprTag percentage={value} showAprSuffix />
          </Skeleton>
        ),
        disableSortBy: true
      },
      {
        Header: <Text translation='defi.stakedAmount' />,
        accessor: 'cryptoAmount',
        isNumeric: true,
        display: { base: 'table-cell' },
        Cell: ({ value }: { value: string }) => {
          return isStaking ? (
            <Amount.Crypto
              value={bnOrZero(value).div(`1e+${asset.precision}`).toString()}
              symbol={asset.symbol}
              color='white'
              fontWeight={'normal'}
            />
          ) : (
            <Box minWidth={{ base: '0px', md: '200px' }} />
          )
        },
        disableSortBy: true
      },
      {
        Header: <Text translation='defi.rewards' />,
        accessor: 'rewards',
        display: { base: 'table-cell' },
        Cell: ({ value }: { value: string }) => {
          return isStaking ? (
            <HStack fontWeight={'normal'}>
              <Amount.Crypto
                value={bnOrZero(value).div(`1e+${asset.precision}`).toString()}
                symbol={asset.symbol}
              />
              <Amount.Fiat
                value={bnOrZero(value)
                  .div(`1e+${asset.precision}`)
                  .times(bnOrZero(marketData.price))
                  .toPrecision()}
                color='green.500'
                prefix='≈'
              />
            </HStack>
          ) : (
            <Button
              onClick={handleGetStartedClick}
              as='span'
              colorScheme='blue'
              variant='ghost-filled'
              size='sm'
              cursor='pointer'
            >
              <Text translation='common.getStarted' />
            </Button>
          )
        },
        disableSortBy: true
      }
    ],
    // React-tables requires the use of a useMemo
    // but we do not want it to recompute the values onClick
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isLoaded]
  )
  return (
    <Card>
      <Card.Header flexDir='row' display='flex'>
        <HStack justify='space-between' flex={1}>
          <Card.Heading>
            <Text translation='staking.staking' />
          </Card.Heading>

          <Button size='sm' variant='link' colorScheme='blue' as={NavLink} to='/defi/earn'>
            <Text translation='common.seeAll' /> <ArrowForwardIcon />
          </Button>
        </HStack>
      </Card.Header>
      <Card.Body pt={0}>
        <ReactTable
          data={!isStaking && isLoaded ? stakingOpportunityDefault : stakingOpportunities}
          columns={columns}
          displayHeaders={isStaking}
          onRowClick={handleStakedClick}
        />
      </Card.Body>
    </Card>
  )
}
