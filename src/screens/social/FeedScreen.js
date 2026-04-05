import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAttractions } from '../../services/attractionService';
import AttractionCard from '../../components/AttractionCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import { COLORS, SIZES, SPACING } from '../../utils/constants';

const FeedScreen = ({ navigation }) => {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAttractions(null, 20).then(({ items }) => {
      setFeed(items);
      setLoading(false);
    });
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Discover Feed</Text>
      {loading ? (
        <LoadingSpinner />
      ) : (
        <FlatList
          data={feed}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <AttractionCard
              item={item}
              onPress={() => navigation.navigate('Detail', { attraction: item })}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text style={styles.empty}>Nothing in the feed yet.</Text>}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  title: { fontSize: SIZES.xxlarge, fontWeight: '700', color: COLORS.text, padding: SPACING.md },
  list: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xl },
  empty: { textAlign: 'center', color: COLORS.textSecondary, marginTop: SPACING.xl },
});

export default FeedScreen;
